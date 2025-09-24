package com.teamanalyzer.teamanalyzer.web.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor(staticName = "of")
public class SurveyResultsDto {
    private double q1;
    private double q2;
    private double q3;
    private double q4;
    private double q5;
    private int responses;
}
