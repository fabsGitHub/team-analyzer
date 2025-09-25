package com.teamanalyzer.teamanalyzer.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.teamanalyzer.teamanalyzer.domain.Survey;

public interface SurveyRepository extends JpaRepository<Survey, UUID> {
    Optional<Survey> findByIdAndTeamId(UUID id, UUID teamId);

    boolean existsByIdAndTeam_Members_User_IdAndTeam_Members_LeaderTrue(UUID surveyId, UUID userId);

    @EntityGraph(attributePaths = "questions")
    List<Survey> findByCreatedBy(UUID createdBy);
}
