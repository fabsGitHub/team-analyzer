package com.teamanalyzer.teamanalyzer.web.dto;

import java.util.List;
import java.util.UUID;

import lombok.Data;

@Data
public class CreateSurveyRequest {
    private UUID teamId;
    private String title;
    private List<String> questions; // genau 5
}
