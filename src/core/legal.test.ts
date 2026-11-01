import { checkLegal, overall } from "./legal";
import { data } from "./testdata";

const byId = (cs: ReturnType<typeof checkLegal>, id: string) => cs.find((c) => c.id === id)!;

describe("Legal – Teilegutachten", () => {
  it("Presets gegen Mindesthöhen", () => {
    const status = Object.fromEntries(
      data.presets.map((p) => {
        const cs = checkLegal(data, { heightFront: p.front, heightRear: p.rear });
        return [p.name, [byId(cs, "hoeheVA").status, byId(cs, "hoeheHA").status]];
      }),
    );
    expect(status["Serie"]).toEqual(["gruen", "gruen"]);
    expect(status["K · Keil"]).toEqual(["gelb", "gruen"]); // 322 = 2 mm Reserve
    expect(status["Bruder (eingetragen)"]).toEqual(["gruen", "gelb"]); // genau 310
    expect(status["Ist-Zustand"]![1]).toBe("unbekannt");
  });
  it("unter der Grenze = rot", () => {
    const cs = checkLegal(data, { heightFront: 315, heightRear: 320 });
    expect(byId(cs, "hoeheVA").status).toBe("rot");
    expect(byId(cs, "hoeheVA").margin).toBe(-5);
    expect(overall(cs)).toBe("rot");
  });
  it("Federteller-Verstellbereich", () => {
    const cs = checkLegal(data, { heightFront: 330, heightRear: 320, perchFront: 240, perchRear: 30 });
    expect(byId(cs, "tellerVA").status).toBe("rot");
    expect(byId(cs, "tellerHA").status).toBe("gruen");
  });
  it("Bodenfreiheit und Felge bleiben Hinweise ohne Messwert", () => {
    const cs = checkLegal(data, { heightFront: 330, heightRear: 320 });
    expect(byId(cs, "boden").status).toBe("unbekannt");
    expect(byId(cs, "rad").text).toContain("346C");
  });
});
