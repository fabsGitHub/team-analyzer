package com.teamanalyzer.teamanalyzer.repo;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.teamanalyzer.teamanalyzer.domain.Team;

@Repository
public interface TeamRepository extends JpaRepository<Team, UUID> {
    @Override
    @EntityGraph(attributePaths = { "members", "members.user" })
    List<Team> findAll();

    // alle Teams als Projection
    List<TeamLiteView> findAllProjectedBy();

    // Teams, in denen der User Mitglied ist
    List<TeamLiteView> findDistinctByMembers_User_Id(UUID userId);

    // Teams, in denen der User Leader ist
    List<TeamLiteView> findDistinctByMembers_User_IdAndMembers_LeaderTrue(UUID userId);
}