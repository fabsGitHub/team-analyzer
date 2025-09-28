package com.teamanalyzer.teamanalyzer.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;

@MappedSuperclass
@EntityListeners(org.springframework.data.jpa.domain.support.AuditingEntityListener.class)
public abstract class AuditedEntity {

    @org.springframework.data.annotation.CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private java.time.Instant createdAt;

    @org.springframework.data.annotation.LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private java.time.Instant updatedAt;

    public java.time.Instant getCreatedAt() {
        return createdAt;
    }

    public java.time.Instant getUpdatedAt() {
        return updatedAt;
    }
}
