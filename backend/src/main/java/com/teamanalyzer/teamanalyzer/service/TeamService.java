// backend/src/main/java/com/teamanalyzer/teamanalyzer/service/TeamService.java
package com.teamanalyzer.teamanalyzer.service;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.teamanalyzer.teamanalyzer.domain.Team;
import com.teamanalyzer.teamanalyzer.domain.TeamMember;
import com.teamanalyzer.teamanalyzer.domain.TeamMemberKey;
import com.teamanalyzer.teamanalyzer.domain.User;
import com.teamanalyzer.teamanalyzer.repo.TeamMemberRepository;
import com.teamanalyzer.teamanalyzer.repo.TeamRepository;
import com.teamanalyzer.teamanalyzer.repo.UserRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepo;
    private final TeamMemberRepository tmRepo;
    private final UserRepository userRepo; // <— NEU: für user-Reference

    @Transactional
    public Team createTeam(String name, UUID leaderUserId) {
        Team t = new Team();
        t.setName(name);
        teamRepo.save(t);
        addMember(t.getId(), leaderUserId, true);
        return t;
    }

    @Transactional
    public void addMember(UUID teamId, UUID userId, boolean leader) {
        Team team = teamRepo.getReferenceById(teamId);
        User user = userRepo.getReferenceById(userId);

        TeamMember tm = TeamMember.builder()
                .team(team) // -> füllt id.teamId via @MapsId
                .user(user) // -> füllt id.userId via @MapsId
                .leader(leader)
                .build();

        tmRepo.save(tm);
    }

    @Transactional
    public void setLeader(UUID teamId, UUID userId, boolean leader) {
        TeamMemberKey id = new TeamMemberKey(teamId, userId);
        TeamMember tm = tmRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        // Wenn Demotion: sicherstellen, dass mindestens ein Leader bleibt
        if (!leader) {
            long leaders = tmRepo.countByTeam_IdAndLeaderTrue(teamId);
            if (leaders <= 1) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Team must have at least one leader");
            }
        }

        tm.setLeader(leader);
        tmRepo.save(tm);
    }

    @Transactional
    public void removeMember(UUID teamId, UUID userId) {
        TeamMemberKey id = new TeamMemberKey(teamId, userId);
        TeamMember tm = tmRepo.findById(id).orElse(null);
        if (tm == null)
            return;

        // Wenn letzter Leader entfernt würde -> verhindern
        if (tm.isLeader()) {
            long leaders = tmRepo.countByTeam_IdAndLeaderTrue(teamId);
            if (leaders <= 1) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Team must have at least one leader");
            }
        }

        tmRepo.deleteById(id);
    }

    // Optionaler Guard, falls du nachträglich prüfen willst (z. B. in anderen
    // Pfaden)
    @SuppressWarnings("unused")
    private void ensureAtLeastOneLeader(UUID teamId) {
        if (!tmRepo.existsByTeam_IdAndLeaderTrue(teamId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Team must have at least one leader");
        }
    }
}
