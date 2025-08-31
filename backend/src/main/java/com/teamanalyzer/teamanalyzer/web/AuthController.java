package com.teamanalyzer.teamanalyzer.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.teamanalyzer.teamanalyzer.domain.RefreshToken;
import com.teamanalyzer.teamanalyzer.domain.User;
import com.teamanalyzer.teamanalyzer.repo.RefreshTokenRepository;
import com.teamanalyzer.teamanalyzer.repo.UserRepository;
import com.teamanalyzer.teamanalyzer.service.JwtService;
import com.teamanalyzer.teamanalyzer.web.dto.LoginDto;
import com.teamanalyzer.teamanalyzer.web.dto.RegisterDto;

import com.teamanalyzer.teamanalyzer.service.EmailVerifyTokenService; // NEW
import com.teamanalyzer.teamanalyzer.service.MailService; // NEW
import org.springframework.beans.factory.annotation.Value; // NEW

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder enc;
    private final JwtService jwt;

    // NEW: Services für E-Mail-Verification
    private final EmailVerifyTokenService emailTokenSvc;
    private final MailService mail;

    // NEW: Link-Basis & Frontend-Route
    private final String frontendBaseUrl;
    private final String verifyEndpointPath;

    public AuthController(
            UserRepository users,
            RefreshTokenRepository tokens,
            PasswordEncoder enc,
            JwtService jwt,
            EmailVerifyTokenService emailTokenSvc, // NEW
            MailService mail, // NEW
            @Value("${app.frontend-base-url}") String frontendBaseUrl, // NEW
            @Value("${app.verify-endpoint-path:/verify}") String verifyEndpointPath // NEW
    ) {
        this.users = users;
        this.tokens = tokens;
        this.enc = enc;
        this.jwt = jwt;
        this.emailTokenSvc = emailTokenSvc;
        this.mail = mail;
        this.frontendBaseUrl = frontendBaseUrl;
        this.verifyEndpointPath = verifyEndpointPath;
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

        // NEW: Verify-Mail rausschicken
        String token = emailTokenSvc.create(email);
        String link = frontendBaseUrl + verifyEndpointPath + "?token=" + token;

        String subject = "Bitte bestätige deine E-Mail-Adresse";
        String body = """
                Willkommen bei TeamAnalyzer!

                Bitte bestätige deine E-Mail, indem du auf den folgenden Link klickst:
                %s

                Der Link ist zeitlich begrenzt gültig.
                """.formatted(link);
        mail.send(email, subject, body);

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
            users.save(user);
        }

        // 204 ist hier passend; Frontend kann auf Erfolg routen
        return ResponseEntity.noContent().build();
    }

    // --- Login ---
    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginDto dto, HttpServletRequest req,
            HttpServletResponse res) {
        var u = users.findByEmail(dto.email()).orElseThrow(() -> new BadCredentialsException("x"));
        if (!u.isEnabled() || !enc.matches(dto.password(), u.getPasswordHash()))
            throw new BadCredentialsException("x");

        var access = jwt.createAccessToken(u);
        var refreshPlain = UUID.randomUUID().toString() + "." + UUID.randomUUID(); // opak
        var rt = new RefreshToken();
        rt.setUser(u);
        rt.setTokenHash(sha256(refreshPlain));
        rt.setExpiresAt(Instant.now().plus(14, ChronoUnit.DAYS));
        rt.setUserAgent(req.getHeader("User-Agent"));
        rt.setIp(req.getRemoteAddr());
        tokens.save(rt);

        ResponseCookie cookie = ResponseCookie.from("refresh_token", refreshPlain)
                .httpOnly(true).secure(true).sameSite("Lax").path("/api/auth").maxAge(Duration.ofDays(14)).build();
        res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok(new TokenResponse(access));
    }

    // --- Refresh ---
    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(@CookieValue("refresh_token") String refresh,
            HttpServletResponse res) {
        var hash = sha256(refresh);
        var rt = tokens.findActiveByHash(hash).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (rt.getExpiresAt().isBefore(Instant.now()) || rt.isRevoked())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);

        // rotate:
        rt.setRevoked(true);
        tokens.save(rt);

        var newPlain = UUID.randomUUID().toString() + "." + UUID.randomUUID();
        var newRt = new RefreshToken();
        newRt.setUser(rt.getUser()); // <-- FIX: User übernehmen
        newRt.setTokenHash(sha256(newPlain));
        newRt.setExpiresAt(Instant.now().plus(14, ChronoUnit.DAYS));
        newRt.setUserAgent(rt.getUserAgent());
        newRt.setIp(rt.getIp());
        tokens.save(newRt);

        ResponseCookie cookie = ResponseCookie.from("refresh_token", newPlain)
                .httpOnly(true).secure(true).sameSite("Lax").path("/api/auth").maxAge(Duration.ofDays(14)).build();
        res.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        var access = jwt.createAccessToken(newRt.getUser());
        return ResponseEntity.ok(new TokenResponse(access));
    }

    // --- Logout ---
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue("refresh_token") String refresh, HttpServletResponse res) {
        tokens.revokeByHash(sha256(refresh));
        ResponseCookie clear = ResponseCookie.from("refresh_token", "")
                .httpOnly(true).secure(true).sameSite("Lax").path("/api/auth").maxAge(0).build();
        res.addHeader(HttpHeaders.SET_COOKIE, clear.toString());
        return ResponseEntity.noContent().build();
    }

    private static String sha256(String s) {
        try {
            var md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

record TokenResponse(String accessToken) {
}
