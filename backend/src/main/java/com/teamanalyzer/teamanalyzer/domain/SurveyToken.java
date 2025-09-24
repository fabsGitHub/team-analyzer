package com.teamanalyzer.teamanalyzer.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "survey_tokens")
public class SurveyToken extends UuidEntity {
  @ManyToOne(optional=false) private Survey survey;
  @Column(length=64) private byte[] tokenHash; // SHA-256
  private String issuedToEmail;
  private Instant issuedAt;
  private Instant redeemedAt;
  private boolean revoked;
}