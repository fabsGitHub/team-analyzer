package com.teamanalyzer.teamanalyzer.repo;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.teamanalyzer.teamanalyzer.domain.SurveyQuestion;

public interface SurveyQuestionRepository extends JpaRepository<SurveyQuestion, UUID> {
    List<SurveyQuestion> findBySurveyIdOrderByIdx(UUID surveyId);
}