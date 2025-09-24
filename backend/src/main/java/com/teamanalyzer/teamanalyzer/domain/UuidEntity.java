package com.teamanalyzer.teamanalyzer.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

// UUID als BINARY(16)
@MappedSuperclass
@Getter
@Setter
public abstract class UuidEntity {
  @Id
  @Column(columnDefinition = "BINARY(16)")
  private UUID id = UUID.randomUUID();
  // + createdAt, version falls du @Version nutzt
}
