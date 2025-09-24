package com.teamanalyzer.teamanalyzer.domain;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.*;

@Embeddable
@Entity
@Table(name = "team_members", uniqueConstraints = @UniqueConstraint(name = "uq_team_member", columnNames = { "team_id",
        "user_id" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class TeamMember {

    @EmbeddedId
    @AttributeOverrides({
            @AttributeOverride(name = "teamId", column = @Column(name = "team_id", nullable = false, columnDefinition = "BINARY(16)")),
            @AttributeOverride(name = "userId", column = @Column(name = "user_id", nullable = false, columnDefinition = "BINARY(16)"))
    })
    @Builder.Default
    private TeamMemberKey id = new TeamMemberKey(); // <- niemals null lassen

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("teamId") // schreibt in id.teamId
    @JoinColumn(name = "team_id", nullable = false, columnDefinition = "BINARY(16)")
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("userId") // schreibt in id.userId
    @JoinColumn(name = "user_id", nullable = false, columnDefinition = "BINARY(16)")
    private User user;

    @Column(nullable = false)
    @Builder.Default
    private boolean leader = false;

    @Column(name = "created_at", updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;

    /**
     * Sicherheitsnetz: vor Persist sicherstellen, dass die EmbeddedId gesetzt ist
     */
    @PrePersist
    void ensureId() {
        if (id == null) {
            id = new TeamMemberKey();
        }
        if (id.getTeamId() == null && team != null) {
            id.setTeamId(team.getId());
        }
        if (id.getUserId() == null && user != null) {
            id.setUserId(user.getId());
        }
    }
}