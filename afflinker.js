const crypto = require("crypto");
const axios = require("axios");
const { URLSearchParams } = require("url");

class AliExpressLibrary {
  constructor(AppKey, API_SECRET, Tracking_ID) {
    this.API_URL = "https://api-sg.aliexpress.com/sync";
    this.AppKey = AppKey;
    this.API_SECRET = API_SECRET;
    this.Tracking_ID = Tracking_ID;
  }

  hash(method, s, format) {
    const sum = crypto.createHash(method);
    const isBuffer = Buffer.isBuffer(s);
    if (!isBuffer && typeof s === "object") {
      s = JSON.stringify(this.sortObject(s));
    }
    sum.update(s, "utf8");
    return sum.digest(format || "hex");
  }

  sortObject(obj) {
    return Object.keys(obj)
      .sort()
      .reduce((result, key) => {
        result[key] = obj[key];
        return result;
      }, {});
  }

  signRequest(parameters) {
    const sortedParams = this.sortObject(parameters);
    const sortedString = Object.keys(sortedParams).reduce((acc, objKey) => {
      return `${acc}${objKey}${sortedParams[objKey]}`;
    }, "");
    const bookstandString = `${this.API_SECRET}${sortedString}${this.API_SECRET}`;
    const signedString = this.hash("md5", bookstandString, "hex");
    return signedString.toUpperCase();
  }

  async getData(id) {
    const payload = {
      app_key: this.AppKey,
      sign_method: "md5",
      timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
      format: "json",
      v: "2.0",
      method: "aliexpress.affiliate.link.generate",
      promotion_link_type: 0,
      tracking_id: this.Tracking_ID,
      source_values: `https://ar.aliexpress.com/i/${id}.html,https://ar.aliexpress.com/i/${id}.html?sourceType=620&channel=coin&aff_fcid=,https://ar.aliexpress.com/i/${id}.html?sourceType=562&aff_fcid=,https://ar.aliexpress.com/i/${id}.html?sourceType=561&aff_fcid=,https://ar.aliexpress.com/i/${id}.html?sourceType=680&aff_fcid=`,
    };
    const sign = this.signRequest(payload);
    const allParams = {
      ...payload,
      sign,
    };
    const affRes = { info: {}, aff: {} };

    try {
      const [aliexpressResponse, afillbotResponse] = await Promise.all([
        axios
          .post(this.API_URL, new URLSearchParams(allParams))
          .catch(() => null),
        axios
          .get(`https://afillbot.com/info?id=${id}&lang=en_DZ`)
          .catch(() => null),
      ]);

      if (aliexpressResponse && aliexpressResponse.data) {
        const mappedData =
          aliexpressResponse.data.aliexpress_affiliate_link_generate_response.resp_result.result.promotion_links.promotion_link.reduce(
            (result, item) => {
              const sourceValue = item.source_value;
              let key = "normal";
              if (sourceValue) {
                if (sourceValue.includes("sourceType=561")) {
                  key = "limited";
                } else if (sourceValue.includes("sourceType=562")) {
                  key = "super";
                } else if (sourceValue.includes("sourceType=620")) {
                  key = "points";
                } else if (sourceValue.includes("sourceType=680")) {
                  key = "bigsave";
                }
              }
              result[key] = item.promotion_link;
              return result;
            },
            {}
          );
        affRes["aff"] = mappedData;
      } else {
        affRes["aff"] = "No data available";
      }

      if (afillbotResponse && afillbotResponse.data) {
        affRes["info"] = afillbotResponse.data;
      } else {
        affRes["info"] = {};
      }
    } catch (error) {
      affRes["aff"] = {};
      affRes["info"] = {};
    }

    return affRes;
  }
}

module.exports = AliExpressLibrary;
