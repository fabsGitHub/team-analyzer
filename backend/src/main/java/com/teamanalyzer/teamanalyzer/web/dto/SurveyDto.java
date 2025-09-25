package com.teamanalyzer.teamanalyzer.web.dto;

import java.util.List;
import java.util.UUID;

import com.teamanalyzer.teamanalyzer.domain.Survey;
import com.teamanalyzer.teamanalyzer.domain.SurveyQuestion;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SurveyDto {
    private UUID id;
    private String title;
    private UUID createdBy;
    private List<Question> questions;

    @Data
    @AllArgsConstructor
    public static class Question {
        UUID id;
        short idx;
        String text;
    }

    public static SurveyDto from(Survey s, List<SurveyQuestion> qs) {
        return new SurveyDto(s.getId(), s.getTitle(), s.getCreatedBy(),
                qs.stream().map(q -> new Question(q.getId(), q.getIdx(), q.getText())).toList());
    }
}
