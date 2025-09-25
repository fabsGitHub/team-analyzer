package com.teamanalyzer.teamanalyzer.web.dto;

import com.teamanalyzer.teamanalyzer.domain.SurveyResponse;

public record SingleSurveyResultDto(
        short q1, short q2, short q3, short q4, short q5
) {
    public static SingleSurveyResultDto from(SurveyResponse r) {
        return new SingleSurveyResultDto(r.getQ1(), r.getQ2(), r.getQ3(), r.getQ4(), r.getQ5());
    }
}
