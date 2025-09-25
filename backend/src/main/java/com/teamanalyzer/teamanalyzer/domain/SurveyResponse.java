package com.teamanalyzer.teamanalyzer.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "survey_responses")
public class SurveyResponse extends UuidEntity {
    @ManyToOne(optional = false)
    private Survey survey;
    @ManyToOne(optional = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id")
    private SurveyToken token; 
    private short q1;
    private short q2;
    private short q3;
    private short q4;
    private short q5;
}
