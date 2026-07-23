import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    redirect_capacity: {
      executor: "constant-arrival-rate",
      duration: __ENV.DURATION || "2m",
      preAllocatedVUs: Number(__ENV.PRE_ALLOCATED_VUS || 50),
      rate: Number(__ENV.REQUEST_RATE || 100),
      timeUnit: "1s",
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<250", "p(99)<750"],
  },
};

const baseUrl = (__ENV.BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const shortCode = __ENV.TEST_SHORT_CODE || "load-test";

export default function () {
  const response = http.get(`${baseUrl}/${shortCode}`, { redirects: 0 });
  check(response, {
    "redirect is successful": (result) => result.status === 301 || result.status === 302,
    "redirect has a location": (result) => Boolean(result.headers.Location),
  });
}
