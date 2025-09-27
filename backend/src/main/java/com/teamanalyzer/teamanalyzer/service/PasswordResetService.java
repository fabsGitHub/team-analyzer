package com.teamanalyzer.teamanalyzer.service;

import com.teamanalyzer.teamanalyzer.domain.User;
import com.teamanalyzer.teamanalyzer.repo.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class PasswordResetService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(PasswordResetService.class);

    private final UserRepository userRepository;
    private final MailService mailService;

    @Value("${app.frontend-base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    @Value("${app.mail.enabled:true}")
    private boolean mailEnabled;

    public PasswordResetService(UserRepository userRepository, MailService mailService) {
        this.userRepository = userRepository;
        this.mailService = mailService;
    }

    @Transactional
    public void sendResetToken(String email) {
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) return; // silently ignore for privacy

        User user = userOpt.get();
        String token = UUID.randomUUID().toString();
        user.setResetToken(token);
        user.setResetTokenCreated(Instant.now());
        userRepository.save(user);

        String link = frontendBaseUrl + "/auth/reset?token=" + token;

        // DEV: immer loggen, damit man ohne SMTP sofort testen kann
        log.info("DEV: Password reset link for {} -> {}", email, link);
        if (mailEnabled) {
            try {
                String subject = "Password Reset for Team Analyzer";
                String body = "Hello,\n\nTo reset your password, click the following link:\n" + link +
                        "\n\nIf you did not request this, you can ignore this email.";
                mailService.send(user.getEmail(), subject, body);
            } catch (Exception ex) {
                System.out.println("E-Mail-Versand fehlgeschlagen (fahre ohne Mail fort): " + ex.toString());
            }
        }
    }

    @Transactional
    public boolean verifyResetToken(String token) {
        Optional<User> userOpt = userRepository.findByResetToken(token);
        if (userOpt.isEmpty()) return false;
        // Optionally: check token age (e.g. valid for 1 hour)
        return true;
    }

    @Transactional
    public boolean resetPassword(String token, String newPassword) {
        Optional<User> userOpt = userRepository.findByResetToken(token);
        if (userOpt.isEmpty()) return false;
        User user = userOpt.get();
        // Passwort hashen! Beispiel mit BCrypt:
        String hash = org.springframework.security.crypto.bcrypt.BCrypt.hashpw(newPassword, org.springframework.security.crypto.bcrypt.BCrypt.gensalt());
        user.setPasswordHash(hash);
        user.setResetToken(null);
        user.setResetTokenCreated(null);
        userRepository.save(user);
        return true;
    }
}
