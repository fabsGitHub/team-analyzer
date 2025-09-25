// src/main/java/com/teamanalyzer/teamanalyzer/web/TeamAdminController.java
package com.teamanalyzer.teamanalyzer.web;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.teamanalyzer.teamanalyzer.domain.Role;
import com.teamanalyzer.teamanalyzer.domain.Team;
import com.teamanalyzer.teamanalyzer.domain.TeamMember;
import com.teamanalyzer.teamanalyzer.domain.TeamMemberKey;
import com.teamanalyzer.teamanalyzer.domain.User;
import com.teamanalyzer.teamanalyzer.repo.TeamMemberRepository;
import com.teamanalyzer.teamanalyzer.repo.TeamRepository;
import com.teamanalyzer.teamanalyzer.repo.UserRepository;
import com.teamanalyzer.teamanalyzer.service.TeamService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/teams")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class TeamAdminController {
    private final TeamService teamService;

    private final TeamRepository teamRepo;
    private final UserRepository userRepo;
    private final TeamMemberRepository teamMemberRepo;

    @PostMapping
    public Team create(@RequestParam String name, @RequestParam UUID leaderUserId) {
        return teamService.createTeam(name, leaderUserId); // legt Team an + 1 Leader
    }

    @GetMapping
    public List<TeamAdminDto> list() {
        return teamRepo.findAll().stream()
                .map(TeamAdminDto::fromEntity)
                .toList();
    }

    @PostMapping("/{teamId}/members")
    @Transactional
    public void addMember(@PathVariable UUID teamId,
            @RequestParam UUID userId,
            @RequestParam(defaultValue = "false") boolean leader) {

        Team team = teamRepo.findById(teamId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        var m = new TeamMember();
        m.setTeam(team);
        m.setUser(user);
        m.setLeader(leader);
        teamMemberRepo.save(m);

        if (leader) {
            // Jetzt ist der User mindestens in einem Team Leader -> Rolle sicherstellen
            if (user.getRoles().add(Role.LEADER)) {
                userRepo.save(user);
            }
        }
    }

    @DeleteMapping("{teamId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void removeMember(@PathVariable UUID teamId, @PathVariable UUID userId) {
        TeamMemberKey key = new TeamMemberKey(teamId, userId);
        TeamMember member = teamMemberRepo.findById(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "member not in team"));

        User user = member.getUser();
        teamMemberRepo.delete(member);

        // Nach dem Entfernen prüfen, ob noch irgendwo Leader/Member -> Rolle anpassen
        syncLeaderRole(user);
    }

    @PatchMapping("{teamId}/leader")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void setLeader(@PathVariable UUID teamId,
            @RequestParam UUID userId,
            @RequestParam boolean leader) {

        TeamMemberKey key = new TeamMemberKey(teamId, userId);
        TeamMember m = teamMemberRepo.findById(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "member not in team"));

        m.setLeader(leader);
        teamMemberRepo.save(m);

        // Rolle anhand der *gesamt* Situation des Users synchronisieren
        User user = m.getUser();
        syncLeaderRole(user);
    }

    @DeleteMapping("/{teamId}")
    @Transactional
    public ResponseEntity<Void> deleteTeam(@PathVariable UUID teamId) {
        // Betroffene User vorher sammeln
        var members = teamMemberRepo.findByTeam_Id(teamId)
                .stream().map(TeamMember::getUser).distinct().toList();

        teamMemberRepo.deleteByTeam_Id(teamId);
        teamRepo.deleteById(teamId);

        // Für jeden betroffenen User Leader-Rolle neu bewerten
        for (User u : members) {
            syncLeaderRole(u);
        }
        return ResponseEntity.noContent().build();
    }

    // simples DTO (nested)
    record TeamAdminDto(UUID id, String name, List<Member> members) {
        record Member(UUID userId, boolean leader) {
        }

        static TeamAdminDto fromEntity(Team t) {
            var members = t.getMembers().stream()
                    .map(m -> new Member(m.getUser().getId(), m.isLeader()))
                    .toList();
            return new TeamAdminDto(t.getId(), t.getName(), members);
        }
    }

    private void syncLeaderRole(User user) {
        UUID uid = user.getId();
        boolean leaderSomewhere = teamMemberRepo.existsByUser_IdAndLeaderTrue(uid);

        // Regel: Sobald kein Leader mehr (oder gar kein Mitglied mehr), Rolle
        // entfernen.
        // Wenn irgendwo Leader, Rolle setzen.
        if (leaderSomewhere) {
            if (user.getRoles().add(Role.LEADER)) {
                userRepo.save(user);
            }
        } else {
            if (user.getRoles().remove(Role.LEADER)) {
                userRepo.save(user);
            }
        }

    }

}
