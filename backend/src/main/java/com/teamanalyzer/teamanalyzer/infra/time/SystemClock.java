// backend/src/main/java/com/teamanalyzer/teamanalyzer/infra/time/SystemClock.java
package com.teamanalyzer.teamanalyzer.infra.time;

import com.teamanalyzer.teamanalyzer.port.AppClock;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component
public class SystemClock implements AppClock {
  @Override public Instant now() { return Instant.now(); }
}

