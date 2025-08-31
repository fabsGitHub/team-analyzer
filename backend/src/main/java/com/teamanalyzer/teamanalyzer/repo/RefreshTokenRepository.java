package com.teamanalyzer.teamanalyzer.repo;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.teamanalyzer.teamanalyzer.domain.RefreshToken;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    /**
     * Findet ein aktives (nicht widerrufenes, nicht abgelaufenes) Token zu einem Hash.
     * Nutzt CURRENT_TIMESTAMP direkt in JPQL, funktioniert in H2 & MySQL.
     */
    @Query("""
           select rt
           from RefreshToken rt
           where rt.tokenHash = :hash
             and rt.revoked = false
             and rt.expiresAt > CURRENT_TIMESTAMP
           """)
    Optional<RefreshToken> findActiveByHash(@Param("hash") String hash);

    /**
     * Markiert ein Token per Hash als widerrufen. Gibt die Anzahl betroffener Zeilen zurück.
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RefreshToken rt set rt.revoked = true where rt.tokenHash = :hash and rt.revoked = false")
    int revokeByHash(@Param("hash") String hash);

    // Optional hilfreich:
    Optional<RefreshToken> findByTokenHash(String tokenHash);
}