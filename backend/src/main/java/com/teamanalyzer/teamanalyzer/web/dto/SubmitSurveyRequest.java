package com.teamanalyzer.teamanalyzer.web.dto;

import lombok.Data;

@Data
public class SubmitSurveyRequest {
    private String token; // Klartexttoken aus Link
    private short q1, q2, q3, q4, q5;
}
