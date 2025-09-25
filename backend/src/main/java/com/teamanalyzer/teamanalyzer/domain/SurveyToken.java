package com.teamanalyzer.teamanalyzer.domain;

import java.time.Instant;

import jakarta.persistence.Column;
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
@Table(name = "survey_tokens")
public class SurveyToken extends UuidEntity {

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  private Survey survey;

  @Column(length = 64, nullable = false)
  private byte[] tokenHash; // SHA-256

  private String issuedToEmail;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "issued_to_user_id")
  private User issuedToUser; // <— neu: Besitzer des Tokens

  private Instant issuedAt;
  private Instant redeemedAt;

  @Column(nullable = false)
  private boolean redeemed = false; // <— Flag gem. DDL vorhanden

  @Column(nullable = false)
  private boolean revoked = false;

  @Column(name = "revoked_at")
  private Instant revokedAt;
}
