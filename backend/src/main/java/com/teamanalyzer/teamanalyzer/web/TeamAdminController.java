// src/main/java/com/teamanalyzer/teamanalyzer/web/TeamAdminController.java
package com.teamanalyzer.teamanalyzer.web;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    public void addMember(@PathVariable UUID teamId,
            @RequestParam UUID userId,
            @RequestParam(defaultValue = "false") boolean leader) {
        Team team = teamRepo.findById(teamId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND));
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND));

        var m = new TeamMember();
        m.setTeam(team);
        m.setUser(user);
        m.setLeader(leader);
        teamMemberRepo.save(m);
    }

    @DeleteMapping("{teamId}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@PathVariable UUID teamId, @PathVariable UUID userId) {
        TeamMemberKey key = new TeamMemberKey(teamId, userId);
        if (!teamMemberRepo.existsById(key)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "member not in team");
        }
        teamMemberRepo.deleteById(key);
    }

    @PatchMapping("{teamId}/leader")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setLeader(@PathVariable UUID teamId,
            @RequestParam UUID userId,
            @RequestParam boolean leader) {
        TeamMemberKey key = new TeamMemberKey(teamId, userId);
        TeamMember m = teamMemberRepo.findById(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "member not in team"));
        m.setLeader(leader);
        teamMemberRepo.save(m);
    }

    @DeleteMapping("/{teamId}")
    public ResponseEntity<Void> deleteTeam(@PathVariable UUID teamId) {
        // Zuerst alle Teammitglieder löschen
        teamMemberRepo.deleteByTeam_Id(teamId);

        // Dann das Team selbst löschen
        teamRepo.deleteById(teamId);

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
}
