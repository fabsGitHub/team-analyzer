package com.teamanalyzer.teamanalyzer.web;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamanalyzer.teamanalyzer.domain.Survey;
import com.teamanalyzer.teamanalyzer.domain.SurveyToken;
import com.teamanalyzer.teamanalyzer.repo.SurveyRepository;
import com.teamanalyzer.teamanalyzer.repo.TeamMemberRepository;
import com.teamanalyzer.teamanalyzer.security.AuthUser;
import com.teamanalyzer.teamanalyzer.service.DownloadTokenService;
import com.teamanalyzer.teamanalyzer.service.SurveyService;
import com.teamanalyzer.teamanalyzer.service.TokenService;
import com.teamanalyzer.teamanalyzer.web.dto.CreateSurveyRequest;
import com.teamanalyzer.teamanalyzer.web.dto.MyTokenDto;
import com.teamanalyzer.teamanalyzer.web.dto.SubmitSurveyRequest;
import com.teamanalyzer.teamanalyzer.web.dto.SurveyDto;
import com.teamanalyzer.teamanalyzer.web.dto.SurveyResultsDto;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/surveys")
@RequiredArgsConstructor
public class SurveyController {

  private final SurveyService surveyService;
  private final TokenService tokenService;
  private final TeamMemberRepository tmRepo;
  private final SurveyRepository surveyRepo;
  private final DownloadTokenService downloadTokens; // ← NEU
  private final ObjectMapper objectMapper;

  @PersistenceContext
  private EntityManager em;

  @Value("${app.frontend-base-url:}")
  private String frontendBaseUrl;

  private boolean hasRole(String role) {
    Authentication a = SecurityContextHolder.getContext().getAuthentication();
    return a != null && a.getAuthorities().stream().anyMatch(ga -> role.equals(ga.getAuthority()));
  }

  // --- Survey anlegen (Leader des Teams oder Admin) ---
  @PostMapping
  public ResponseEntity<SurveyDto> create(
      @AuthenticationPrincipal AuthUser me,
      @RequestBody @Validated CreateSurveyRequest req) {
    if (req.getQuestions() == null || req.getQuestions().size() != 5)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Require exactly 5 questions");
    if (me == null || me.userId() == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    if (req.getTeamId() == null)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing teamId");

    boolean isAdmin = hasRole("ROLE_ADMIN");
    boolean isLeaderOfTeam = tmRepo.existsByTeam_IdAndUser_IdAndLeaderTrue(req.getTeamId(), me.userId());
    if (!(isAdmin || isLeaderOfTeam))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must be leader of the selected team");

    var survey = surveyService.createSurvey(me.userId(), req.getTeamId(), req.getTitle(), req.getQuestions());
    var dto = surveyService.getSurvey(survey.getId());
    return ResponseEntity
        .created(URI.create("/api/surveys/" + survey.getId()))
        .body(dto);
  }

  // --- Fragen lesen (öffentlich) ---
  @GetMapping("/{id}")
  public SurveyDto get(@PathVariable UUID id) {
    return surveyService.getSurvey(id);
  }

  // --- Antworten abgeben (öffentlich mit One-Time-Token) ---
  @PostMapping("/{id}/responses")
  public ResponseEntity<Void> submit(@PathVariable UUID id, @RequestBody @Validated SubmitSurveyRequest req) {
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

  // --- Ergebnisse (nur Admin oder Leader des Survey-Teams) ---
  @GetMapping("/{id}/results")
  public SurveyResultsDto results(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
    if (me == null || me.userId() == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    boolean isAdmin = hasRole("ROLE_ADMIN");
    boolean isLeaderOfTeam = surveyRepo.existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(id, me.userId());
    if (!(isAdmin || isLeaderOfTeam)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must be leader of this survey's team");
    }
    return surveyService.getResults(me.userId(), id);
  }

  // --- Tokens für alle Teammitglieder des Surveys sicherstellen ---
  @PostMapping("/{id}/tokens/for-members")
  public Map<String, Object> issueForMembers(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
    if (me == null || me.userId() == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    boolean isAdmin = hasRole("ROLE_ADMIN");
    boolean isLeaderOfTeam = surveyRepo.existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(id, me.userId());
    if (!(isAdmin || isLeaderOfTeam)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You must be leader of this survey's team");
    }
    int created = tokenService.ensureTokensForAllTeamMembers(id);
    return Map.of("created", created, "surveyId", id);
  }

  @PutMapping("/{id}/my-token")
  public com.teamanalyzer.teamanalyzer.web.dto.MyTokenDto ensureMyToken(
      @AuthenticationPrincipal AuthUser me,
      @PathVariable UUID id,
      HttpServletRequest req) {
    if (me == null || me.userId() == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

    UUID teamId = surveyRepo.findTeamIdById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    boolean isMember = tmRepo.existsByTeam_IdAndUser_Id(teamId, me.userId());
    if (!isMember && !hasRole("ROLE_ADMIN")) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this survey's team");
    }

    Survey surveyRef = em.getReference(Survey.class, id);

    // idempotent: erzeugt NUR, wenn noch kein aktives Token existiert
    String plain = tokenService.ensurePersonalToken(surveyRef, me.userId(), me.email());

    boolean created = (plain != null);
    String inviteLink = (plain != null) ? buildInviteLink(req, id, plain) : null;

    return new com.teamanalyzer.teamanalyzer.web.dto.MyTokenDto(created, inviteLink);
  }

  // --- Mitglied fordert bewusst einen neuen (alte werden revoked) ---
  @PostMapping("/{id}/my-token/renew")
  public MyTokenDto renewMyToken(@AuthenticationPrincipal AuthUser me,
      @PathVariable UUID id, HttpServletRequest req) {
    if (me == null || me.userId() == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

    UUID teamId = surveyRepo.findTeamIdById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    boolean isMember = tmRepo.existsByTeam_IdAndUser_Id(teamId, me.userId());
    if (!isMember && !hasRole("ROLE_ADMIN")) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this survey's team");
    }

    Survey surveyRef = em.getReference(Survey.class, id);
    String plain = tokenService.renewPersonalToken(surveyRef, me.userId(), me.email());
    String inviteLink = buildInviteLink(req, id, plain);
    return new MyTokenDto(true, inviteLink);
  }

  /*
   * @GetMapping("/{id}/results/download-link")
   * public Map<String, String> makeDownloadLink(@AuthenticationPrincipal AuthUser
   * me, @PathVariable UUID id,
   * HttpServletRequest req) {
   * if (me == null || me.userId() == null)
   * throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
   * boolean isAdmin = hasRole("ROLE_ADMIN");
   * boolean isLeaderOfTeam =
   * surveyRepo.existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(id,
   * me.userId());
   * if (!(isAdmin || isLeaderOfTeam))
   * throw new ResponseStatusException(HttpStatus.FORBIDDEN);
   * 
   * String dl = downloadTokens.issue(id, me.userId(),
   * java.time.Duration.ofMinutes(5));
   * String base = (frontendBaseUrl != null && !frontendBaseUrl.isBlank())
   * ? frontendBaseUrl.replaceAll("/+$", "")
   * : buildBaseFromRequest(req);
   * String url = base + "/api/surveys/" + id + "/results/download?dl=" + dl;
   * return Map.of("url", url);
   * }
   */

  @PostMapping("/{id}/download-tokens")
  public ResponseEntity<Map<String, String>> createDownloadLink(
      @AuthenticationPrincipal AuthUser me,
      @PathVariable UUID id,
      HttpServletRequest req) {
    if (me == null || me.userId() == null)
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    boolean isAdmin = hasRole("ROLE_ADMIN");
    boolean isLeaderOfTeam = surveyRepo.existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(id, me.userId());
    if (!(isAdmin || isLeaderOfTeam))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);

    String dl = downloadTokens.issue(id, me.userId(), java.time.Duration.ofMinutes(5));
    String base = (frontendBaseUrl != null && !frontendBaseUrl.isBlank())
        ? frontendBaseUrl.replaceAll("/+$", "")
        : buildBaseFromRequest(req);
    String url = base + "/api/surveys/" + id + "/results/download?dl=" + dl;

    return ResponseEntity
        .created(URI.create(url))
        .body(Map.of("url", url));
  }

  @GetMapping("/{id}/results/download")
  public ResponseEntity<byte[]> downloadViaToken(@PathVariable UUID id, @RequestParam("dl") String dl)
      throws Exception {
    UUID userId = downloadTokens.verifyAndExtractUser(dl, id);
    // optional: zusätzliche Berechtigung prüfen (z.B. member/leader/admin):
    boolean allowed = hasRole("ROLE_ADMIN") ||
        surveyRepo.existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(id, userId) ||
        tmRepo.existsByTeam_IdAndUser_Id(
            surveyRepo.findTeamIdById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)),
            userId);
    if (!allowed)
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);

    SurveyResultsDto dto = surveyService.getResults(userId, id);
    byte[] json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(dto);
    return ResponseEntity.ok()
        .header("Content-Disposition", "attachment; filename=\"survey-" + id + "-results.json\"")
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
        .body(json);
  }

  private String buildBaseFromRequest(HttpServletRequest req) {
    String scheme = req.getScheme();
    String host = req.getServerName();
    int port = req.getServerPort();
    boolean isDefault = ("http".equalsIgnoreCase(scheme) && port == 80) ||
        ("https".equalsIgnoreCase(scheme) && port == 443);
    return scheme + "://" + host + (isDefault ? "" : (":" + port));
  }

  // WICHTIG: Invite-Link soll die SPA öffnen (ohne /api)
  private String buildInviteLink(HttpServletRequest req, UUID surveyId, String plain) {
    String base = (frontendBaseUrl != null && !frontendBaseUrl.isBlank())
        ? frontendBaseUrl.replaceAll("/+$", "")
        : buildBaseFromRequest(req);
    return base + "/surveys/" + surveyId + "?token=" + URLEncoder.encode(plain, StandardCharsets.UTF_8);
  }
}
