package com.teamanalyzer.teamanalyzer.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.teamanalyzer.teamanalyzer.filter.JwtAuthFilter;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwt) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth

            .requestMatchers("/api/auth/**", "/error").permitAll() // /error erlauben!
            
            // Auth & Health offen
            .requestMatchers("/api/auth/**", "/actuator/health").permitAll()

            // --- Survey-Teilnahme anonym ---
            .requestMatchers(HttpMethod.GET, "/api/surveys/*").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/surveys/*/responses").permitAll()

            // --- Survey-Management nur Leader/Admin ---
            .requestMatchers("/api/surveys/**").hasAnyRole("LEADER", "ADMIN")

            // --- Admin-Bereich ---
            .requestMatchers("/api/admin/**").hasRole("ADMIN")

            // (optional) statische Inhalte / Swagger etc. hier freischalten

            // alles andere braucht Login
            .anyRequest().authenticated())
        .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
        .exceptionHandling(e -> e
            .authenticationEntryPoint((req, res, ex) -> res.setStatus(401))
            .accessDeniedHandler((req, res, ex) -> res.setStatus(403)));

    return http.build();
  }

  @Bean
  CorsConfigurationSource cors() {
    var cfg = new CorsConfiguration();
    // Falls du zusätzlich Prod-Origins hast: füg sie hier hinzu
    cfg.setAllowedOrigins(List.of("http://localhost:5173"));
    cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With"));
    cfg.setAllowCredentials(true);
    cfg.setMaxAge(3600L);

    var src = new UrlBasedCorsConfigurationSource();
    src.registerCorsConfiguration("/**", cfg);
    return src;
  }
}
