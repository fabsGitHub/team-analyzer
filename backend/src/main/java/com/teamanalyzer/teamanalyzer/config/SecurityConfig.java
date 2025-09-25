package com.teamanalyzer.teamanalyzer.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
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

@Configuration
@EnableMethodSecurity
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
            // Preflight erlauben
            .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

            // offen
            .requestMatchers("/error", "/actuator/health", "/api/auth/**").permitAll()

            // öffentliche Survey-Endpunkte
            .requestMatchers(HttpMethod.GET, "/api/surveys/*").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/surveys/*/responses").permitAll()

            // Survey-Management nur eingeloggt; fachliche Prüfung macht der Controller
            .requestMatchers("/api/surveys/**").authenticated()

            // Admin-Bereich
            .requestMatchers("/api/admin/**").hasRole("ADMIN")

            // Rest
            .anyRequest().authenticated())
        .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
        .exceptionHandling(e -> e
            .authenticationEntryPoint((req, res, ex) -> res.setStatus(HttpStatus.UNAUTHORIZED.value()))
            .accessDeniedHandler((req, res, ex) -> res.setStatus(HttpStatus.FORBIDDEN.value())));

    return http.build();
  }

  @Bean
  CorsConfigurationSource cors() {
    var cfg = new CorsConfiguration();
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
