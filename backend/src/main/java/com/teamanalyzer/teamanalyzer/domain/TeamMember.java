package com.teamanalyzer.teamanalyzer.domain;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@Table(name = "team_members", uniqueConstraints = @UniqueConstraint(name = "uq_team_member", columnNames = { "team_id",
        "user_id" }))
public class TeamMember {

    @EmbeddedId
    private TeamMemberKey id = new TeamMemberKey();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("teamId")
    @JoinColumn(name = "team_id", nullable = false, columnDefinition = "BINARY(16)")
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false, columnDefinition = "BINARY(16)")
    private User user;

    @Column(nullable = false)
    private boolean leader = false;

    @Column(name = "created_at", updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    protected TeamMember() {
    }

    public static TeamMember of(Team team, User user, boolean leader) {
        TeamMember tm = new TeamMember();
        tm.team = team;
        tm.user = user;
        tm.leader = leader;
        tm.id = new TeamMemberKey(team.getId(), user.getId());
        return tm;
    }

    @PrePersist
    void ensureId() {
        if (id == null)
            id = new TeamMemberKey();
        if (id.getTeamId() == null && team != null)
            id.setTeamId(team.getId());
        if (id.getUserId() == null && user != null)
            id.setUserId(user.getId());
    }
}
