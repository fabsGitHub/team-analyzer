package com.teamanalyzer.teamanalyzer.service;

import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.teamanalyzer.teamanalyzer.domain.Survey;
import com.teamanalyzer.teamanalyzer.domain.SurveyAnswer;
import com.teamanalyzer.teamanalyzer.domain.SurveyAnalytics;
import com.teamanalyzer.teamanalyzer.domain.SurveyQuestion;
import com.teamanalyzer.teamanalyzer.domain.SurveyResponse;
import com.teamanalyzer.teamanalyzer.domain.SurveyToken;
import com.teamanalyzer.teamanalyzer.domain.Team;
import com.teamanalyzer.teamanalyzer.port.DigestService;
import com.teamanalyzer.teamanalyzer.repo.SurveyQuestionRepository;
import com.teamanalyzer.teamanalyzer.repo.SurveyRepository;
import com.teamanalyzer.teamanalyzer.repo.SurveyResponseRepository;
import com.teamanalyzer.teamanalyzer.repo.TeamMemberRepository;
import com.teamanalyzer.teamanalyzer.web.dto.SurveyDto;
import com.teamanalyzer.teamanalyzer.web.dto.SurveyResultsDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SurveyService {

    private final SurveyRepository surveyRepo;
    private final SurveyQuestionRepository questionRepo;
    private final SurveyResponseRepository responseRepo;
    private final TeamMemberRepository tmRepo;
    private final TokenService tokenService;
    private final DigestService digest; // ⟵ neu: für Hash aus Plain-Token

    public Survey createSurvey(UUID leaderId, UUID teamId, String title, List<String> qTexts) {
        boolean isLeader = tmRepo.existsByTeam_IdAndUser_IdAndLeaderTrue(teamId, leaderId);
        if (!isLeader) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only team leaders can create surveys");
        }

        Team teamRef = Team.ref(teamId);
        Survey s = Survey.create(teamRef, leaderId, title);
        surveyRepo.save(s);

        short idx = 1;
        for (String text : qTexts) {
            SurveyQuestion q = new SurveyQuestion();
            q.setSurvey(s);
            q.setIdx(idx++);
            q.setText(text);
            questionRepo.save(q);
        }
        return s;
    }

    @Transactional(readOnly = true)
    public SurveyDto getSurvey(UUID id) {
        Survey s = surveyRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<SurveyQuestion> qs = questionRepo.findBySurveyIdOrderByIdx(id);
        return SurveyDto.from(s, qs);
    }

    /**
     * Neuer, atomarer Submit-Flow (Plain-Token-Eintritt): Plain → SHA-256 → hex →
     * delegiert.
     */
    @Transactional
    public void submitAnonymousByPlainToken(UUID surveyId, String plainToken, short[] answers) {
        if (plainToken == null || plainToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing token");
        }
        String tokenHashHex = HexFormat.of().formatHex(digest.sha256(plainToken));
        submitAnonymous(surveyId, tokenHashHex, answers);
    }

    /**
     * Token wird in derselben Tx gelockt & erst nach erfolgreichem Persist
     * verbraucht.
     */
    @Transactional
    public void submitAnonymous(UUID surveyId, String tokenHashHex, short[] answers) {
        if (answers == null || answers.length != 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Require 5 answers");
        }

        // Token validieren + PESSIMISTIC_WRITE sperren (nicht als redeemed markieren!)
        SurveyToken tok = tokenService.acquireForSubmission(surveyId, tokenHashHex);

        // Fragen (1..5) holen
        List<SurveyQuestion> qs = questionRepo.findBySurveyIdOrderByIdx(surveyId);
        if (qs.size() < 5) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Survey must contain 5 questions");
        }

        // Response + Antworten bauen
        Survey sRef = Survey.ref(surveyId);
        SurveyResponse r = SurveyResponse.create(sRef, tok);

        // Antworten in stabiler Reihenfolge anfügen (0-basiert)
        for (int i = 0; i < 5; i++) {
            SurveyAnswer a = new SurveyAnswer();
            a.setQuestion(qs.get(i));
            a.setValue(answers[i]); // Likert-Wert
            a.setAnswerOrder(i); // korrespondiert mit @OrderColumn(answer_order)
            r.addAnswer(a);
        }

        // persist (kaskadiert answers)
        responseRepo.save(r);

        // Token erst NACH erfolgreichem Persist verbrauchen (gleiche Tx)
        tokenService.consume(tok);
    }

    // ---- Kompatibilitäts-Overloads (kannst du behalten oder später aufräumen)
    // ----

    @Transactional
    public void submitAnonymous(UUID surveyId, SurveyToken tok, short[] answers) {
        submitAnonymous(surveyId, tok.getTokenHash(), answers);
    }

    @Transactional
    public void submitAnonymous(UUID surveyId, byte[] tokenHash, short[] answers) {
        submitAnonymous(surveyId, HexFormat.of().formatHex(tokenHash), answers);
    }

    @Transactional(readOnly = true)
    public SurveyResultsDto getResults(UUID requesterId, UUID surveyId) {
        List<SurveyResponse> all = responseRepo.findWithAnswersBySurveyId(surveyId);
        double[] avg = SurveyAnalytics.averages(all);
        int n = all.size();

        var items = all.stream()
                .map(com.teamanalyzer.teamanalyzer.web.dto.SingleSurveyResultDto::from)
                .toList();

        return com.teamanalyzer.teamanalyzer.web.dto.SurveyResultsDto.of(
                avg[0], avg[1], avg[2], avg[3], avg[4], n, items);
    }
}
