package com.teamanalyzer.teamanalyzer.domain;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Table(name = "refresh_tokens", indexes = {
        @Index(name = "ix_rt_user_revoked", columnList = "user_id, revoked"),
        @Index(name = "ix_rt_revoked_expires", columnList = "revoked, expires_at"),
        @Index(name = "ix_rt_expires_at", columnList = "expires_at")
})
public class RefreshToken extends AuditedEntity {

    @Id
    @Setter(AccessLevel.NONE)
    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "BINARY(16)")
    private UUID id = UUID.randomUUID();

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, columnDefinition = "BINARY(16)")
    @Setter(AccessLevel.PACKAGE)
    private User user;

    // BINARY(32) für SHA-256
    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "token_hash", nullable = false, unique = true, columnDefinition = "BINARY(32)")
    private byte[] tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "ip", length = 45)
    private String ip;

    @Column(name = "revoked", nullable = false)
    private boolean revoked = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null)
            createdAt = now;
        if (updatedAt == null)
            updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    protected RefreshToken() {
    }

    public RefreshToken(byte[] tokenHash, Instant expiresAt, String userAgent, String ip) {
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.userAgent = userAgent;
        this.ip = ip;
    }

    public boolean isExpired(Instant now) {
        return now.isAfter(expiresAt);
    }

    public void revoke() {
        this.revoked = true;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || org.hibernate.Hibernate.getClass(this) != org.hibernate.Hibernate.getClass(o))
            return false;
        RefreshToken other = (RefreshToken) o;
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    public void setUser(User u) {
        this.user = u;
    }

    public void setTokenHash(String h) {
        this.tokenHash = decodeTokenHash(h);
    }

    public void setExpiresAt(Instant t) {
        this.expiresAt = t;
    }

    public void setUserAgent(String ua) {
        this.userAgent = ua;
    }

    public void setIp(String ip) {
        this.ip = ip;
    }

    public void setRevoked(boolean revoked) {
        this.revoked = revoked;
    }

    public User getUser() {
        return user;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public boolean isRevoked() {
        return revoked;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getIp() {
        return ip;
    }

    public static RefreshToken of(User u, String hash, Instant exp, String ua, String ip) {
        RefreshToken rt = new RefreshToken();
        rt.user = u;
        rt.tokenHash = decodeTokenHash(hash);
        rt.expiresAt = exp;
        rt.userAgent = ua;
        rt.ip = ip;
        return rt;
    }

    private static byte[] decodeTokenHash(String h) {
        return java.util.Base64.getUrlDecoder().decode(h);
    }
}
