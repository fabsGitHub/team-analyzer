// src/main/java/com/teamanalyzer/teamanalyzer/filter/JwtAuthFilter.java
package com.teamanalyzer.teamanalyzer.filter;

import java.io.IOException;
import java.util.List;
import java.util.Set;
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

    private static final Set<String> AUTH_PATHS = Set.of(
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/verify",
            "/api/auth/refresh");

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
            var claims = jwt.validate(token);

            // Email (subject=email; Fallback auf "email"-Claim)
            String email = claims.getSubject();
            if (email == null || email.isBlank()) {
                try {
                    email = claims.getStringClaim("email");
                } catch (Exception ignored) {
                }
            }

            // userId aus Claim "uid" robust lesen
            String uidStr = null;
            try {
                uidStr = claims.getStringClaim("uid");
            } catch (Exception ignored) {
                Object v = claims.getClaim("uid");
                if (v != null)
                    uidStr = String.valueOf(v);
            }
            UUID userId = null;
            try {
                userId = UUID.fromString(uidStr);
            } catch (Exception ignored) {
            }

            // Rollen als Strings aus dem Token
            @SuppressWarnings("unchecked")
            var roleList = (List<String>) claims.getClaim("roles");
            if (roleList == null)
                roleList = List.of();

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
            // ungültiges Token -> keine Auth; geschützte Endpunkte liefern dann 401
        }

        chain.doFilter(req, res);
    }
}
