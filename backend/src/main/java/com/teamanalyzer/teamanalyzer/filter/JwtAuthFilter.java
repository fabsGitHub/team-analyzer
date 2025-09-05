package com.teamanalyzer.teamanalyzer.filter;

import java.io.IOException;
import java.util.List;
import java.util.Set;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;

import com.teamanalyzer.teamanalyzer.service.JwtService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);
    private final JwtService jwt;
    private final UserDetailsService uds;

    private static final Set<String> AUTH_PATHS = Set.of(
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/verify",
            "/api/auth/refresh" // refresh nutzt Cookie; kein Bearer nötig
    );

    public JwtAuthFilter(JwtService jwt, UserDetailsService uds) {
        this.jwt = jwt;
        this.uds = uds;
    }

    /*
     * @Override
     * protected void doFilterInternal(HttpServletRequest req, HttpServletResponse
     * res, FilterChain chain)
     * throws ServletException, IOException {
     * 
     * // 1) Auth-Endpoints komplett durchlassen (auch wenn ein Authorization-Header
     * da
     * // ist)
     * String path = req.getRequestURI();
     * if (AUTH_PATHS.contains(path)) {
     * chain.doFilter(req, res);
     * return;
     * }
     * 
     * // 2) Bestehende Auth nicht überschreiben
     * Authentication existing =
     * SecurityContextHolder.getContext().getAuthentication();
     * if (existing != null && existing.isAuthenticated()) {
     * chain.doFilter(req, res);
     * return;
     * }
     * 
     * // 3) Bearer-Header robust prüfen
     * String header = req.getHeader("Authorization");
     * if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
     * chain.doFilter(req, res);
     * return;
     * }
     * 
     * String token = header.substring(7).trim();
     * if (token.isEmpty() || "null".equalsIgnoreCase(token) ||
     * "undefined".equalsIgnoreCase(token)) {
     * chain.doFilter(req, res);
     * return;
     * }
     * 
     * try {
     * var claims = jwt.validate(token); // darf Exceptions werfen
     * String email = null;
     * try {
     * email = claims.getStringClaim("email");
     * } catch (Exception ignored) {
     * }
     * if (email != null) {
     * var user = uds.loadUserByUsername(email);
     * var authToken = new UsernamePasswordAuthenticationToken(user, null,
     * user.getAuthorities());
     * SecurityContextHolder.getContext().setAuthentication(authToken);
     * }
     * } catch (Exception ex) {
     * log.debug("JWT invalid: {} ({})", ex.getMessage(), req.getRequestURI());
     * // NIEMALS 401 hier; einfach anonym weiter
     * }
     * 
     * chain.doFilter(req, res);
     * }
     */

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

            // Identität
            String email = claims.getSubject(); // du setzt subject = email

            // Rollen aus dem Token lesen (Array von Strings)
            @SuppressWarnings("unchecked")
            var roleList = (List<String>) claims.getClaim("roles");
            if (roleList == null)
                roleList = List.of();

            var authorities = roleList.stream()
                    .map(r -> r.startsWith("ROLE_") ? r : "ROLE_" + r)
                    .map(SimpleGrantedAuthority::new)
                    .toList();

            var authentication = new UsernamePasswordAuthenticationToken(email, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);

        } catch (Exception ex) {
            // Token ist wirklich ungültig (Signatur/Expired/Parse)
            log.debug("JWT invalid: {} ({})", ex.getMessage(), req.getRequestURI());
            // Kein Throw – ungeauthentifiziert weiter -> 401 auf geschützten Endpunkten
        }

        chain.doFilter(req, res);
    }

}
