package com.teamanalyzer.teamanalyzer.repo;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.teamanalyzer.teamanalyzer.domain.Survey;

public interface SurveyRepository extends JpaRepository<Survey, UUID> {
    Optional<Survey> findByIdAndTeamId(UUID id, UUID teamId);
}
