package com.teamanalyzer.teamanalyzer.web;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.teamanalyzer.teamanalyzer.domain.Survey;
import com.teamanalyzer.teamanalyzer.domain.SurveyToken;
import com.teamanalyzer.teamanalyzer.security.AuthUser;
import com.teamanalyzer.teamanalyzer.service.SurveyService;
import com.teamanalyzer.teamanalyzer.service.TokenService;
import com.teamanalyzer.teamanalyzer.web.dto.CreateSurveyRequest;
import com.teamanalyzer.teamanalyzer.web.dto.SubmitSurveyRequest;
import com.teamanalyzer.teamanalyzer.web.dto.SurveyDto;
import com.teamanalyzer.teamanalyzer.web.dto.SurveyResultsDto;
import com.teamanalyzer.teamanalyzer.web.dto.TokenBatchDto;
import com.teamanalyzer.teamanalyzer.repo.TeamMemberRepository;
import com.teamanalyzer.teamanalyzer.repo.SurveyRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/surveys")
@RequiredArgsConstructor
public class SurveyController {

  private final SurveyService surveyService;
  private final TokenService tokenService;
  private final TeamMemberRepository tmRepo;
  private final SurveyRepository surveyRepo;

  private boolean hasRole(String role) {
    Authentication a = SecurityContextHolder.getContext().getAuthentication();
    return a != null && a.getAuthorities().stream().anyMatch(ga -> role.equals(ga.getAuthority()));
  }

  // leader/admin: Survey anlegen
  @PostMapping
  public SurveyDto create(@AuthenticationPrincipal AuthUser me,
      @RequestBody @Validated CreateSurveyRequest req) {

    if (req.getQuestions() == null || req.getQuestions().size() != 5) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Require exactly 5 questions");
    }
    if (me == null || me.userId() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    if (req.getTeamId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing teamId");
    }

    // Admin darf immer; sonst nur Leader dieses Teams
    boolean isAdmin = hasRole("ROLE_ADMIN");
    boolean isLeaderOfTeam = tmRepo.existsByTeam_IdAndUser_IdAndLeaderTrue(req.getTeamId(), me.userId());
    if (!(isAdmin || isLeaderOfTeam)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must be leader of the selected team");
    }

    var survey = surveyService.createSurvey(me.userId(), req.getTeamId(), req.getTitle(), req.getQuestions());
    return surveyService.getSurvey(survey.getId());
  }

  // public/anonymous: Survey lesen (Fragen)
  @GetMapping("/{id}")
  public SurveyDto get(@PathVariable UUID id) {
    return surveyService.getSurvey(id);
  }

  // public/anonymous: Antworten abgeben (mit One-Time-Token)
  @PostMapping("/{id}/responses")
  public ResponseEntity<Void> submit(@PathVariable UUID id,
      @RequestBody @Validated SubmitSurveyRequest req) {
    if (req.getToken() == null || req.getToken().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing token");
    }
    SurveyToken tok = tokenService.redeem(id, req.getToken());
    surveyService.submitAnonymous(
        id,
        tok,
        new short[] { req.getQ1(), req.getQ2(), req.getQ3(), req.getQ4(), req.getQ5() });
    return ResponseEntity.accepted().build();
  }

  // leader/admin: Ergebnisse sehen (Service prüft zusätzlich
  // Team-Leadership/Admin)
  @GetMapping("/{id}/results")
  public SurveyResultsDto results(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
    if (me == null || me.userId() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    boolean isAdmin = hasRole("ROLE_ADMIN");
    boolean isLeaderOfTeam = surveyRepo.existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(id, me.userId());
    if (!(isAdmin || isLeaderOfTeam)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must be leader of this survey's team");
    }
    if (!(isAdmin || isLeaderOfTeam)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must be leader of this survey's team");
    }
    return surveyService.getResults(me.userId(), id);
  }

  // leader/admin: Tokens erzeugen (Batch)
  @PostMapping("/{id}/tokens/batch")
  public List<String> issueTokens(@AuthenticationPrincipal AuthUser me,
      @PathVariable UUID id,
      @RequestBody @Validated TokenBatchDto dto) {
    if (me == null || me.userId() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    if (dto.getCount() <= 0 || dto.getCount() > 1000) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "count must be 1..1000");
    }

    boolean isAdmin = hasRole("ROLE_ADMIN");
    boolean isLeaderOfTeam = surveyRepo.existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(id, me.userId());
    if (!(isAdmin || isLeaderOfTeam)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must be leader of this survey's team");
    }

    // Token-Erzeugung
    Survey surveyRef = new Survey();
    surveyRef.setId(id);

    return IntStream.range(0, dto.getCount())
        .mapToObj(i -> tokenService.issueToken(surveyRef, null))
        .toList();
  }
}
