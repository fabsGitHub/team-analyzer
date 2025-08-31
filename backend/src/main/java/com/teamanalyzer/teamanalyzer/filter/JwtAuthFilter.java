package com.teamanalyzer.teamanalyzer.filter;

import java.io.IOException;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.teamanalyzer.teamanalyzer.service.JwtService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final UserDetailsService uds;

    public JwtAuthFilter(JwtService jwt, UserDetailsService uds) {
        this.jwt = jwt;
        this.uds = uds;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        var h = req.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ")) {
            var token = h.substring(7);
            try {
                var claims = jwt.validate(token);
                String email;
                try {
                    email = claims.getStringClaim("email");
                } catch (java.text.ParseException e) {
                    // leave unauthenticated if parsing fails
                    email = null;
                }
                if (email != null) {
                    var user = uds.loadUserByUsername(email);
                    var auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (AuthenticationException ex) {
                /* leave unauthenticated */ }
        }
        chain.doFilter(req, res);
    }
}
