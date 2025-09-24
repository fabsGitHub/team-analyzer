package com.teamanalyzer.teamanalyzer.repo;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.teamanalyzer.teamanalyzer.domain.SurveyToken;

public interface SurveyTokenRepository extends JpaRepository<SurveyToken, UUID> {
    Optional<SurveyToken> findByTokenHashAndSurveyId(byte[] hash, UUID surveyId);

    long countBySurveyIdAndRedeemedAtIsNotNull(UUID surveyId);
}