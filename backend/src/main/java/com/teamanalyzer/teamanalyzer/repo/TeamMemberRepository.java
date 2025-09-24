// backend/src/main/java/com/teamanalyzer/teamanalyzer/repo/TeamMemberRepository.java
package com.teamanalyzer.teamanalyzer.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import com.teamanalyzer.teamanalyzer.domain.TeamMember;
import com.teamanalyzer.teamanalyzer.domain.TeamMemberKey;


public interface TeamMemberRepository extends JpaRepository<TeamMember, TeamMemberKey> {

    // Liste aller Mitglieder eines Teams
    List<TeamMember> findByTeam_Id(UUID teamId);

    // Gibt es mind. einen Leader in Team?
    boolean existsByTeam_IdAndLeaderTrue(UUID teamId);

    long countByTeam_IdAndLeaderTrue(UUID teamId);

    // Mitglied per Team+User
    Optional<TeamMember> findByTeam_IdAndUser_Id(UUID teamId, UUID userId);

    boolean existsByTeam_IdAndUser_Id(UUID teamId, UUID userId);

    // Ist bestimmtes Mitglied Leader?
    boolean existsByTeam_IdAndUser_IdAndLeaderTrue(UUID teamId, UUID userId);

    boolean existsByUser_IdAndLeaderTrue(UUID userId);

    // Entfernen
    @Transactional
    void deleteByTeam_IdAndUser_Id(UUID teamId, UUID userId);

    @Transactional
    void deleteByTeam_Id(UUID teamId);

}
