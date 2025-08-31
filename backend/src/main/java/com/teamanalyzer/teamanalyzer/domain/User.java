package com.teamanalyzer.teamanalyzer.domain;

import java.time.Instant;
import java.util.*;

import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Entity
@Getter
@Setter
@Table(name = "users", indexes = {
        @Index(name = "ix_users_email", columnList = "email", unique = true),
        @Index(name = "ix_users_created_at", columnList = "created_at")
})
public class User {

    @Id
    @Setter(AccessLevel.NONE)
    @JdbcTypeCode(SqlTypes.BINARY)  
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "BINARY(16)")
    private UUID id = UUID.randomUUID();

    @Email
    @NotBlank
    @Column(name = "email", nullable = false, length = 254, unique = true)
    private String email;

    // Optional robust: zusätzlich normalisierte Spalte mit Unique-Index
    // @Column(name = "email_normalized", nullable = false, length = 254, unique =
    // true)
    // private String emailNormalized;

    @ToString.Exclude
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash; // z.B. bcrypt ~60, Reserve für künftige Algorithmen

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 50)
    private Set<RefreshToken> refreshTokens = new HashSet<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"), uniqueConstraints = @UniqueConstraint(columnNames = {
            "user_id", "role" }))
    @Column(name = "role", nullable = false, length = 64)
    @Enumerated(EnumType.STRING)
    private Set<Role> roles = new HashSet<>(Set.of(Role.USER));

    @Column(name = "enabled", nullable = false)
    private boolean enabled = false; // nach E-Mail-Verify true

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @PrePersist
    @PreUpdate
    private void normalize() {
        if (email != null)
            email = email.trim().toLowerCase(Locale.ROOT);
        // if (email != null) emailNormalized = email.trim().toLowerCase(Locale.ROOT);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || org.hibernate.Hibernate.getClass(this) != org.hibernate.Hibernate.getClass(o))
            return false;
        User other = (User) o;
        return id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }
}
