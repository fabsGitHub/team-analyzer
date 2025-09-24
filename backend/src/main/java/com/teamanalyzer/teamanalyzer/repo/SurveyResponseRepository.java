package com.teamanalyzer.teamanalyzer.repo;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.teamanalyzer.teamanalyzer.domain.SurveyResponse;

public interface SurveyResponseRepository extends JpaRepository<SurveyResponse, UUID> {
    List<SurveyResponse> findBySurveyId(UUID surveyId);
}
