package com.teamanalyzer.teamanalyzer.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.stereotype.Component;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.teamanalyzer.teamanalyzer.domain.User;

@Component
public class JwtService {
    @Value("${app.jwt.secret}")
    private String secret; // 256-bit base64
    @Value("${app.jwt.ttl-minutes:15}")
    private long ttl;

    public String createAccessToken(User u) {
        var now = Instant.now();
        var claims = new JWTClaimsSet.Builder()
                .subject(u.getId().toString())
                .issuer("teamanalyzer")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(ttl, ChronoUnit.MINUTES)))
                .claim("email", u.getEmail())
                .claim("roles", u.getRoles())
                .build();
        MACSigner signer;
        try {
            signer = new MACSigner(Base64.getDecoder().decode(secret));
        } catch (com.nimbusds.jose.KeyLengthException e) {
            throw new RuntimeException("Invalid JWT secret key length", e);
        }
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        try {
            jwt.sign(signer);
        } catch (JOSEException e) {
            throw new RuntimeException(e);
        }
        return jwt.serialize();
    }

    public JWTClaimsSet validate(String token) {
        try {
            var jwt = SignedJWT.parse(token);
            var verifier = new MACVerifier(Base64.getDecoder().decode(secret));
            if (!jwt.verify(verifier))
                throw new BadCredentialsException("Invalid signature");
            var exp = jwt.getJWTClaimsSet().getExpirationTime().toInstant();
            if (Instant.now().isAfter(exp))
                throw new CredentialsExpiredException("Expired");
            return jwt.getJWTClaimsSet();
        } catch (Exception e) {
            throw new BadCredentialsException("Invalid token", e);
        }
    }
}
