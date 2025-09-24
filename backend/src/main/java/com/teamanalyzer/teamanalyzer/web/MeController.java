// MeController.java
package com.teamanalyzer.teamanalyzer.web;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.teamanalyzer.teamanalyzer.security.AuthUser;
import com.teamanalyzer.teamanalyzer.repo.TeamLiteView;
import com.teamanalyzer.teamanalyzer.repo.TeamMemberRepository;
import com.teamanalyzer.teamanalyzer.repo.TeamRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MeController {

    private final TeamMemberRepository teamMemberRepository;
    private final TeamRepository teamRepository;

    @GetMapping("/me")
    public Map<String, Object> me(Authentication auth) {
        var roles = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        String email = auth.getName();
        String id = null;
        boolean isLeader = false;

        Object p = auth.getPrincipal();
        if (p instanceof AuthUser ap && ap.userId() != null) {
            UUID userId = ap.userId();
            id = userId.toString();
            email = ap.email();

            isLeader = teamMemberRepository.existsByUser_IdAndLeaderTrue(userId);
        }

        return Map.of("id", id, "email", email, "roles", roles, "isLeader", isLeader);
    }

    @GetMapping("/me/teams")
    public List<TeamLiteView> myTeams(Authentication auth) {
        var au = (AuthUser) auth.getPrincipal();
        var userId = au.userId();
        return teamRepository
                .findDistinctByMembers_User_IdAndMembers_LeaderTrue(userId);
    }
}
