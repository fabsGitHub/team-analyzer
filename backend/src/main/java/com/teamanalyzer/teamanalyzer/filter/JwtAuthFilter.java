// src/main/java/com/teamanalyzer/teamanalyzer/filter/JwtAuthFilter.java
package com.teamanalyzer.teamanalyzer.filter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
// UserDetailsService bleibt optional injiziert (wird hier nicht genutzt)
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.nimbusds.jwt.JWTClaimsSet;
import com.teamanalyzer.teamanalyzer.security.AuthUser;
import com.teamanalyzer.teamanalyzer.service.JwtService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    private final JwtService jwt;
    @SuppressWarnings("unused")
    private final UserDetailsService uds;

    public JwtAuthFilter(JwtService jwt, UserDetailsService uds) {
        this.jwt = jwt;
        this.uds = uds;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String auth = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            chain.doFilter(req, res);
            return;
        }

        String token = auth.substring(7).trim();

        try {
            JWTClaimsSet claims = jwt.validate(token);

            // Email aus Subject; Fallback auf "email"-Claim
            String email = extractEmail(claims);

            // userId aus Claim "uid" robust lesen
            UUID userId = toUuidOrNull(extractUidString(claims));

            // Rollen als Strings aus dem Token
            List<String> roleList = extractRoles(claims);

            // Authorities daraus ableiten
            var authorities = roleList.stream()
                    .map(r -> r.startsWith("ROLE_") ? r : "ROLE_" + r)
                    .map(SimpleGrantedAuthority::new)
                    .toList();

            // Principal mit (userId, email, roles[String])
            var principal = new AuthUser(userId, email, roleList);

            var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);

        } catch (Exception ex) {
            log.debug("JWT invalid: {} ({})", ex.getMessage(), req.getRequestURI());
            // Ungültiges Token -> keine Auth; geschützte Endpunkte liefern dann 401
        }

        chain.doFilter(req, res);
    }

    /**
     * Email bevorzugt aus dem Subject lesen; falls leer/fehlend,
     * auf den String-Claim "email" zurückfallen.
     * Manche IdPs setzen "email" nicht oder in anderem Typ.
     */
    private String extractEmail(JWTClaimsSet claims) {
        String email = claims.getSubject();
        if (email == null || email.isBlank()) {
            try {
                email = claims.getStringClaim("email");
            } catch (Exception e) {
                // Claim fehlt oder hat falschen Typ -> email bleibt null
            }
        }
        return email;
    }

    /**
     * Versucht "uid" als String-Claim zu lesen; wenn der Claim kein String ist,
     * wird ein generischer Claim geholt und in String konvertiert.
     */
    private String extractUidString(JWTClaimsSet claims) {
        try {
            return claims.getStringClaim("uid");
        } catch (Exception e) {
            Object v = claims.getClaim("uid");
            return v != null ? String.valueOf(v) : null;
        }
    }

    /**
     * Parsed eine UUID sicher; bei Fehlern wird null zurückgegeben.
     */
    private UUID toUuidOrNull(String uidStr) {
        try {
            return uidStr != null ? UUID.fromString(uidStr) : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Liest die Rollenliste; akzeptiert List<?> und konvertiert zu List<String>.
     */
    private List<String> extractRoles(JWTClaimsSet claims) {
        Object raw = claims.getClaim("roles");
        if (raw instanceof List<?>) {
            return ((List<?>) raw).stream().map(String::valueOf).toList();
        }
        return List.of();
    }
}
