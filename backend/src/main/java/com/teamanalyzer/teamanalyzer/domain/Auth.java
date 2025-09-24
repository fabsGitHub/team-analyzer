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
}

