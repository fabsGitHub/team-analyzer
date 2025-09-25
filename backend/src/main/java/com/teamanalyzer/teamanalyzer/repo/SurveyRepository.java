package com.teamanalyzer.teamanalyzer.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.teamanalyzer.teamanalyzer.domain.Survey;

public interface SurveyRepository extends JpaRepository<Survey, UUID> {
    Optional<Survey> findByIdAndTeamId(UUID id, UUID teamId);

    boolean existsByIdAndTeam_Members_User_Id(UUID surveyId, UUID userId);

    boolean existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(UUID surveyId, UUID userId);

    @EntityGraph(attributePaths = "questions")
    List<Survey> findByCreatedBy(UUID createdBy);

    // Team-ID zu einem Survey ermitteln (sauberer Name!)
    @Query("select s.team.id from Survey s where s.id = :id")
    Optional<UUID> findTeamIdById(UUID id);
}
