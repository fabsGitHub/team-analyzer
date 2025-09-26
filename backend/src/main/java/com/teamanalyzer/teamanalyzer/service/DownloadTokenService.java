package com.teamanalyzer.teamanalyzer.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Service
public class DownloadTokenService {
  private final ObjectMapper om;
  private final Mac mac;

  public DownloadTokenService(@Value("${app.download-token-secret}") String secret, ObjectMapper om) {
    this.om = om;
    try {
      mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    } catch (Exception e) {
      throw new IllegalStateException("Cannot init HMAC", e);
    }
  }

  public String issue(UUID surveyId, UUID userId, Duration ttl) {
    try {
      long exp = Instant.now().plus(ttl).getEpochSecond();
      String json = om.writeValueAsString(Map.of(
          "sid", surveyId.toString(),
          "uid", userId.toString(),
          "exp", exp
      ));
      String payload = Base64.getUrlEncoder().withoutPadding()
          .encodeToString(json.getBytes(StandardCharsets.UTF_8));
      String sig = sign(payload);
      return payload + "." + sig;
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "token issue failed");
    }
  }

  public UUID verifyAndExtractUser(String token, UUID expectedSurveyId) {
    try {
      String[] parts = token.split("\\.");
      if (parts.length != 2) throw unauth();
      String payload = parts[0];
      String sig = parts[1];
      if (!sign(payload).equals(sig)) throw unauth();

      byte[] raw = Base64.getUrlDecoder().decode(payload);
      JsonNode n = om.readTree(new String(raw, StandardCharsets.UTF_8));

      if (!expectedSurveyId.toString().equals(n.path("sid").asText())) throw unauth();
      if (Instant.now().getEpochSecond() > n.path("exp").asLong()) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "token expired");
      }
      return UUID.fromString(n.path("uid").asText());
    } catch (ResponseStatusException rse) {
      throw rse;
    } catch (Exception e) {
      throw unauth();
    }
  }

  private String sign(String payloadB64) {
    byte[] s = mac.doFinal(payloadB64.getBytes(StandardCharsets.UTF_8));
    return Base64.getUrlEncoder().withoutPadding().encodeToString(s);
  }

  private ResponseStatusException unauth() {
    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid token");
  }
}
