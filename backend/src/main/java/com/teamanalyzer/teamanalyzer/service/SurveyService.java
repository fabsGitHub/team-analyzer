// backend/src/main/java/com/teamanalyzer/teamanalyzer/service/SurveyService.java
package com.teamanalyzer.teamanalyzer.service;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.teamanalyzer.teamanalyzer.domain.Survey;
import com.teamanalyzer.teamanalyzer.domain.SurveyQuestion;
import com.teamanalyzer.teamanalyzer.domain.SurveyResponse;
import com.teamanalyzer.teamanalyzer.domain.SurveyToken;
import com.teamanalyzer.teamanalyzer.domain.Team;
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

    public Survey createSurvey(UUID leaderId, UUID teamId, String title, List<String> qTexts) {
        // Nur Team-Leader des Teams dürfen Surveys erstellen
        boolean isLeader = tmRepo.existsByTeam_IdAndUser_IdAndLeaderTrue(teamId, leaderId);
        if (!isLeader)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only team leaders can create surveys");

        Survey s = new Survey();
        // Team als Reference setzen (kein zusätzliches DB-Load nötig)
        Team tRef = new Team();
        tRef.setId(teamId);
        s.setTeam(tRef);
        s.setCreatedBy(leaderId);
        s.setTitle(title);
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

    public SurveyDto getSurvey(UUID id) {
        Survey s = surveyRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<SurveyQuestion> qs = questionRepo.findBySurveyIdOrderByIdx(id);
        return SurveyDto.from(s, qs);
    }

    public void submitAnonymous(UUID surveyId, SurveyToken tok, short[] answers) {
        if (answers == null || answers.length != 5)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Require 5 answers");

        SurveyResponse r = new SurveyResponse();
        Survey sRef = new Survey();
        sRef.setId(surveyId);
        r.setSurvey(sRef);
        r.setToken(tok);
        r.setQ1(answers[0]);
        r.setQ2(answers[1]);
        r.setQ3(answers[2]);
        r.setQ4(answers[3]);
        r.setQ5(answers[4]);
        responseRepo.save(r);
    }

    public SurveyResultsDto getResults(UUID requesterId, UUID surveyId) {

        List<SurveyResponse> all = responseRepo.findBySurveyId(surveyId);

        double[] sum = new double[5];
        for (SurveyResponse r : all) {
            sum[0] += r.getQ1();
            sum[1] += r.getQ2();
            sum[2] += r.getQ3();
            sum[3] += r.getQ4();
            sum[4] += r.getQ5();
        }

        int n = all.size();
        double a1 = n == 0 ? 0 : sum[0] / n;
        double a2 = n == 0 ? 0 : sum[1] / n;
        double a3 = n == 0 ? 0 : sum[2] / n;
        double a4 = n == 0 ? 0 : sum[3] / n;
        double a5 = n == 0 ? 0 : sum[4] / n;

        var items = all.stream()
                .map(com.teamanalyzer.teamanalyzer.web.dto.SingleSurveyResultDto::from)
                .toList();

        return com.teamanalyzer.teamanalyzer.web.dto.SurveyResultsDto.of(a1, a2, a3, a4, a5, n, items);
    }
}
