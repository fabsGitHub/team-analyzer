package com.teamanalyzer.teamanalyzer.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.Check;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(name = "evaluations", indexes = {
                @Index(name = "ix_eval_team_created", columnList = "team, created_at"),
                @Index(name = "ix_eval_created", columnList = "created_at")
})
@Check(constraints = "appreciation BETWEEN 1 AND 5 AND " +
                "equality     BETWEEN 1 AND 5 AND " +
                "workload     BETWEEN 1 AND 5 AND " +
                "collegiality BETWEEN 1 AND 5 AND " +
                "transparency BETWEEN 1 AND 5")
public class Evaluation {

    @Id
    @Setter(AccessLevel.NONE)
    @JdbcTypeCode(SqlTypes.BINARY)  
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "BINARY(16)")
    private UUID id = UUID.randomUUID();

        @NotBlank
        @Size(max = 120)
        @Column(nullable = false, length = 120)
        private String name;

        @NotBlank
        @Size(max = 64)
        @Column(nullable = false, length = 64)
        private String team;

        @Min(1)
        @Max(5)
        @Column(nullable = false)
        private byte appreciation;

        @Min(1)
        @Max(5)
        @Column(nullable = false)
        private byte equality;

        @Min(1)
        @Max(5)
        @Column(nullable = false)
        private byte workload;

        @Min(1)
        @Max(5)
        @Column(nullable = false)
        private byte collegiality;

        @Min(1)
        @Max(5)
        @Column(nullable = false)
        private byte transparency;

        @CreationTimestamp
        @Column(name = "created_at", updatable = false, nullable = false)
        private Instant createdAt;

        @UpdateTimestamp
        @Column(name = "updated_at", nullable = false)
        private Instant updatedAt;

        @Version
        @Column(nullable = false)
        private long version;

        @Override
        public boolean equals(Object o) {
                if (this == o)
                        return true;
                if (o == null || org.hibernate.Hibernate.getClass(this) != org.hibernate.Hibernate.getClass(o))
                        return false;
                Evaluation other = (Evaluation) o;
                return id != null && id.equals(other.id);
        }

        @Override
        public int hashCode() {
                return id.hashCode();
        }
}
