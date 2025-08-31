package com.teamanalyzer.teamanalyzer.domain;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;

@Component
@ConfigurationProperties("app.auth")
@Getter
@Setter
public class Auth {
  private String issuer;
  private long emailVerifyExpMin;
  private String hmacSecret;

  // getters/setters OR use record + @ConstructorBinding
  public String issuer() { return issuer; }
  public long emailVerifyExpMin() { return emailVerifyExpMin; }
  public String hmacSecret() { return hmacSecret; }
  public void setIssuer(String v) { issuer = v; }
  public void setEmailVerifyExpMin(long v) { emailVerifyExpMin = v; }
  public void setHmacSecret(String v) { hmacSecret = v; }
}

