package com.teamanalyzer.teamanalyzer.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "survey_questions")
public class SurveyQuestion extends UuidEntity {
  @ManyToOne(optional=false) private Survey survey;
  private short idx;      // 1..5
  private String text;
}