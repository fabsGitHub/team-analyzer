package com.teamanalyzer.teamanalyzer.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.teamanalyzer.teamanalyzer.domain.Survey;
import com.teamanalyzer.teamanalyzer.domain.SurveyResponse;
import com.teamanalyzer.teamanalyzer.domain.SurveyToken;
import com.teamanalyzer.teamanalyzer.domain.User;
import com.teamanalyzer.teamanalyzer.repo.SurveyRepository;
import com.teamanalyzer.teamanalyzer.repo.SurveyTokenRepository;
import com.teamanalyzer.teamanalyzer.repo.TeamMemberRepository;

import jakarta.annotation.Nullable;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TokenService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(TokenService.class);

    private final SurveyTokenRepository tokenRepo;
    private final SurveyRepository surveyRepo;
    private final TeamMemberRepository tmRepo;

    @PersistenceContext
    private EntityManager em;

    // Ein persönliches Token für einen konkreten User sicherstellen (erzeugen,
    // falls keins aktiv)
    @Transactional
    public String ensurePersonalToken(Survey survey, UUID userId, @Nullable String email) {
        var existing = tokenRepo.findFirstBySurvey_IdAndIssuedToUser_IdAndRedeemedFalseAndRevokedFalse(
                survey.getId(), userId);
        if (existing.isPresent())
            return null;

        String plain = UUID.randomUUID().toString();
        byte[] hash = sha256(plain);
        log.info("ISSUE new token: plain={} hash={}", plain, HexFormat.of().formatHex(hash));

        var tok = new SurveyToken();
        tok.setSurvey(survey);
        tok.setTokenHash(hash);
        tok.setIssuedAt(Instant.now());
        tok.setIssuedToEmail(email);
        tok.setIssuedToUser(em.getReference(User.class, userId));
        tokenRepo.save(tok);
        return plain;
    }

    /**
     * Alle offenen Tokens (nicht redeemed, nicht revoked) eines Users für ein
     * Survey auf revoked setzen.
     */
    @Transactional
    public int revokeOpenTokensForUser(UUID surveyId, UUID userId) {
        return tokenRepo.revokeActiveForUser(surveyId, userId);
    }

    /**
     * Renew-Flow: offene Tokens revoke’n und ein frisches persönliches Token
     * ausstellen.
     */
    @Transactional
    public String renewPersonalToken(Survey survey, UUID userId, @Nullable String email) {
        revokeOpenTokensForUser(survey.getId(), userId);
        String plain = ensurePersonalToken(survey, userId, email);
        if (plain == null) {
            // Falls parallel wieder eins erstellt wurde, erneut revoke’n und frisch
            // erzeugen:
            revokeOpenTokensForUser(survey.getId(), userId);
            plain = ensurePersonalToken(survey, userId, email);
        }
        if (plain == null) {
            throw new IllegalStateException("Could not renew token deterministically");
        }
        return plain;
    }

    // Für ALLE Teammitglieder Tokens anlegen (nur neue, keine Duplikate)
    @Transactional
    public int ensureTokensForAllTeamMembers(UUID surveyId) {
        var teamId = surveyRepo.findTeamIdById(surveyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var members = tmRepo.findByTeam_Id(teamId);
        var surveyRef = em.getReference(Survey.class, surveyId);

        int created = 0;
        for (var m : members) {
            var uid = m.getUser().getId();
            var email = m.getUser().getEmail();
            var plain = ensurePersonalToken(surveyRef, uid, email);
            if (plain != null)
                created++;
        }
        return created;
    }

    /** Liste aller offenen Tokens (nicht eingelöst/ nicht revoked) eines Users */
    @Transactional(readOnly = true)
    public List<SurveyToken> listOpenTokensForUser(UUID userId) {
        return tokenRepo.findOpenByUser(userId);
    }

    @Transactional(readOnly = true)
    public Optional<SurveyToken> findActivePersonalToken(UUID surveyId, UUID userId) {
        return tokenRepo.findFirstBySurvey_IdAndIssuedToUser_IdAndRedeemedFalseAndRevokedFalse(surveyId, userId);
    }

    /** Einlösen: prüft Gültigkeit, markiert, gibt Token zurück */
    @Transactional
    public SurveyToken redeem(UUID surveyId, String plainToken) {
        log.info("REDEEM token: plain={} hash={}", plainToken, HexFormat.of().formatHex(sha256(plainToken)));

        byte[] hash = sha256(plainToken);
        log.info("redeem(): surveyId={} token={} (first8={})", surveyId, plainToken,
                plainToken != null ? plainToken.substring(0, 8) : null);

        var tok = tokenRepo.findByTokenHashAndSurvey_Id(hash, surveyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid token"));
        if (tok.isRevoked() || tok.isRedeemed())
            throw new ResponseStatusException(HttpStatus.GONE, "Token already used");

        tok.setRedeemed(true);
        tok.setRedeemedAt(Instant.now());
        return tokenRepo.save(tok);
    }

    /**
     * Nach erfolgreicher Antwort: Response entkoppeln und Token endgültig löschen
     */
    @Transactional
    public void consumeAndDeleteToken(SurveyResponse response, SurveyToken token) {
        response.setToken(null);
        tokenRepo.delete(token); // dank ON DELETE SET NULL kein FK-Bruch
    }

    private byte[] sha256(String s) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
