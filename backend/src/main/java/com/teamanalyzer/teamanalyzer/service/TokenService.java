package com.teamanalyzer.teamanalyzer.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.teamanalyzer.teamanalyzer.domain.Survey;
import com.teamanalyzer.teamanalyzer.domain.SurveyToken;
import com.teamanalyzer.teamanalyzer.repo.SurveyTokenRepository;

import jakarta.annotation.Nullable;

@Service
public class TokenService {
    @Autowired
    private SurveyTokenRepository tokenRepo;

    public String issueToken(Survey survey, @Nullable String email) {
        String plain = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID();
        byte[] hash = sha256(plain);
        SurveyToken t = new SurveyToken();
        t.setSurvey(survey);
        t.setTokenHash(hash);
        t.setIssuedToEmail(email);
        t.setIssuedAt(Instant.now());
        tokenRepo.save(t);
        return plain; // Klartext wandert nur in den Link
    }

    public SurveyToken redeem(UUID surveyId, String plainToken) {
        byte[] hash = sha256(plainToken);
        SurveyToken tok = tokenRepo.findByTokenHashAndSurveyId(hash, surveyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid token"));
        if (tok.isRevoked() || tok.getRedeemedAt() != null) {
            throw new ResponseStatusException(HttpStatus.GONE, "Token already used");
        }
        tok.setRedeemedAt(Instant.now());
        return tokenRepo.save(tok);
    }

    private byte[] sha256(String s) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
