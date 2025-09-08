package com.teamanalyzer.teamanalyzer.web;

import com.teamanalyzer.teamanalyzer.domain.RefreshToken;
import com.teamanalyzer.teamanalyzer.domain.User;
import com.teamanalyzer.teamanalyzer.repo.RefreshTokenRepository;
import com.teamanalyzer.teamanalyzer.repo.UserRepository;
import com.teamanalyzer.teamanalyzer.service.EmailVerifyTokenService;
import com.teamanalyzer.teamanalyzer.service.JwtService;
import com.teamanalyzer.teamanalyzer.service.MailService;
import com.teamanalyzer.teamanalyzer.service.PasswordResetService;
import com.teamanalyzer.teamanalyzer.web.dto.LoginDto;
import com.teamanalyzer.teamanalyzer.web.dto.RegisterDto;
import com.teamanalyzer.teamanalyzer.web.dto.ResetPasswordDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository users;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder enc;
    private final JwtService jwt;
    private final EmailVerifyTokenService emailTokenSvc;
    private final MailService mail;
    private final PasswordResetService passwordResetService;

    private final String frontendBaseUrl;
    private final String verifyEndpointPath;

    @Value("${app.mail.enabled:true}")
    private boolean mailEnabled;

    @Value("${app.cookies.secure:true}")
    private boolean cookieSecure;

    public AuthController(
            UserRepository users,
            RefreshTokenRepository tokens,
            PasswordEncoder enc,
            JwtService jwt,
            EmailVerifyTokenService emailTokenSvc,
            MailService mail,
            PasswordResetService passwordResetService,
            @Value("${app.frontend-base-url}") String frontendBaseUrl,
            @Value("${app.verify-endpoint-path}") String verifyEndpointPath) {
        this.users = users;
        this.tokens = tokens;
        this.enc = enc;
        this.jwt = jwt;
        this.emailTokenSvc = emailTokenSvc;
        this.mail = mail;
        this.passwordResetService = passwordResetService;
        this.frontendBaseUrl = frontendBaseUrl;
        this.verifyEndpointPath = verifyEndpointPath;
    }

    private ResponseCookie buildRefreshCookie(String value, HttpServletRequest req, long maxAgeSeconds) {
        return ResponseCookie.from("refresh_token", value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .build();
    }

    // --- Register ---
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterDto dto) {
        String email = dto.email().trim().toLowerCase();

        if (users.existsByEmail(email))
            return ResponseEntity.status(409).build();

        var u = new User();
        u.setEmail(email);
        u.setPasswordHash(enc.encode(dto.password()));
        u.setEnabled(false);
        users.save(u);

        // Verify-Token erzeugen und Link bauen
        String token = emailTokenSvc.create(email);
        String link = frontendBaseUrl + verifyEndpointPath + "?token=" + token;

        log.info("DEV: Verification link for {} -> {}", email, link);

        if (mailEnabled) {
            try {
                String subject = "Bitte bestätige deine E-Mail-Adresse";
                String body = """
                        Willkommen bei TeamAnalyzer!

                        Bitte bestätige deine E-Mail, indem du auf den folgenden Link klickst:
                        %s

                        Der Link ist zeitlich begrenzt gültig.
                        """.formatted(link);
                mail.send(email, subject, body);
            } catch (Exception ex) {
                log.warn("E-Mail-Versand fehlgeschlagen (fahre ohne Mail fort): {}", ex.toString());
            }
        }

        return ResponseEntity.ok().build();
    }

    // --- Verify ---
    @GetMapping("/verify")
    public ResponseEntity<?> verify(@RequestParam String token) {
        String email = emailTokenSvc.validateAndGetEmail(token);

        var user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!user.isEnabled()) {
            user.setEnabled(true);
            user.setEmailVerifiedAt(Instant.now());
            users.save(user);
        }
        return ResponseEntity.noContent().build();
    }

    // --- Login ---
    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginDto dto,
                                               HttpServletRequest req,
                                               HttpServletResponse res) {
        String email = dto.email().trim().toLowerCase();
        var u = users.findByEmailWithRoles(email).orElseThrow(() -> new BadCredentialsException("x"));
        if (!u.isEnabled() || !enc.matches(dto.password(), u.getPasswordHash()))
            throw new BadCredentialsException("x");

        var access = jwt.createAccessToken(u);
        var refreshPlain = UUID.randomUUID().toString() + "." + UUID.randomUUID();
        var rt = new RefreshToken();
        rt.setUser(u);
        rt.setTokenHash(sha256(refreshPlain));
        rt.setExpiresAt(Instant.now().plus(14, ChronoUnit.DAYS));
        rt.setUserAgent(req.getHeader("User-Agent"));
        rt.setIp(req.getRemoteAddr());
        tokens.save(rt);

        res.addHeader(HttpHeaders.SET_COOKIE,
                buildRefreshCookie(refreshPlain, req, Duration.ofDays(14).toSeconds()).toString());
        return ResponseEntity.ok(new TokenResponse(access));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(@CookieValue("refresh_token") String refresh,
                                                 HttpServletResponse res) {
        var hash = sha256(refresh);
        var rt = tokens.findActiveByHashWithUserAndRoles(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        if (rt.getExpiresAt().isBefore(Instant.now()) || rt.isRevoked())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

        // rotate:
        rt.setRevoked(true);
        tokens.save(rt);

        var newPlain = UUID.randomUUID().toString() + "." + UUID.randomUUID();
        var newRt = new RefreshToken();
        newRt.setUser(rt.getUser());
        newRt.setTokenHash(sha256(newPlain));
        newRt.setExpiresAt(Instant.now().plus(14, ChronoUnit.DAYS));
        newRt.setUserAgent(rt.getUserAgent());
        newRt.setIp(rt.getIp());
        tokens.save(newRt);

        var access = jwt.createAccessToken(rt.getUser());
        var cookie = ResponseCookie.from("refresh_token", newPlain)
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(Duration.ofDays(14))
                .build();
        res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return ResponseEntity.ok(new TokenResponse(access));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue("refresh_token") String refresh,
                                       HttpServletRequest req,
                                       HttpServletResponse res) {
        tokens.revokeByHash(sha256(refresh));
        res.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie("", req, 0).toString());
        return ResponseEntity.noContent().build();
    }

    // --- Password Reset: Request Token ---
    @PostMapping("/reset")
    public ResponseEntity<?> sendResetToken(@Valid @RequestBody ResetPasswordDto dto) {
        passwordResetService.sendResetToken(dto.email().trim().toLowerCase());
        // Immer OK zurückgeben, damit niemand E-Mail-Adressen prüfen kann
        return ResponseEntity.ok().build();
    }

    // --- Password Reset: Set New Password ---
    @PostMapping("/reset/confirm")
    public ResponseEntity<?> resetPassword(@RequestParam String token, @RequestParam String newPassword) {
        boolean ok = passwordResetService.resetPassword(token, newPassword);
        if (!ok) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid or expired token.");
        }
        return ResponseEntity.ok().build();
    }

    private static String sha256(String s) {
        try {
            var md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    record TokenResponse(String accessToken) {}
}
