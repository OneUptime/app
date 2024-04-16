import Color from '../../Types/Color';
import {
    Black,
    White,
    Slate500,
    Purple500,
    Pink500,
    Red500,
    Orange500,
    Yellow500,
    Green500,
    Teal500,
    Cyan500,
    VeryLightGray,
    Gray500,
    LightGray,
    Moroon500,
    Blue500,
} from '../../Types/BrandColors';

describe('Color', () => {
    describe('Verify color hex', () => {
        it('should create a new instance with the given hex code', () => {
            const color: Color = new Color('#123456');
            expect(color).toBe(color);
        });
    });
    describe('Black', () => {
        it('should be an instance with the hex code of Black', () => {
            const color: Color = Black;
            expect(Black).toBe(color);
            expect(Black.color).toBe('#000000');
        });
    });
    describe('White', () => {
        it('should be an instance with the hex code of White', () => {
            const color: Color = White;
            expect(White).toBe(color);
            expect(White.color).toBe('#ffffff');
        });
    });
    describe('slate', () => {
        it('should be an instance with the hex code of slate', () => {
            const color: Color = Slate500;
            expect(Slate500).toBe(color);
            expect(Slate500.color).toBe('#564ab1');
        });
    });
    describe('Purple500', () => {
        it('should be an instance with the hex code of Purple500', () => {
            const color: Color = Purple500;
            expect(Purple500).toBe(color);
            expect(Purple500.color).toBe('#6f42c1');
        });
    });
    describe('Pink500', () => {
        it('should be an instance with the hex code of Pink500', () => {
            const color: Color = Pink500;
            expect(Pink500).toBe(color);
            expect(Pink500.color).toBe('#e83e8c');
        });
    });
    describe('Red500', () => {
        it('should be an instance with the hex code of Red500', () => {
            const color: Color = Red500;
            expect(Red500).toBe(color);
            expect(Red500.color).toBe('#fd625e');
        });
    });
    describe('Orange500', () => {
        it('should be an instance with the hex code of Orange500', () => {
            const color: Color = Orange500;
            expect(Orange500).toBe(color);
            expect(Orange500.color).toBe('#f1734f');
        });
    });
    describe('Yellow500', () => {
        it('should be an instance with the hex code of Yellow500', () => {
            const color: Color = Yellow500;
            expect(Yellow500).toBe(color);
            expect(Yellow500.color).toBe('#ffbf53');
        });
    });
    describe('Green500', () => {
        it('should be an instance with the hex code of Green500', () => {
            const color: Color = Green500;
            expect(Green500).toBe(color);
            expect(Green500.color).toBe('#2ab57d');
        });
    });
    describe('Teal500', () => {
        it('should be an instance with the hex code of Teal500', () => {
            const color: Color = Teal500;
            expect(Teal500).toBe(color);
            expect(Teal500.color).toBe('#050505');
        });
    });
    describe('Cyan500', () => {
        it('should be an instance with the hex code of Cyan500', () => {
            const color: Color = Cyan500;
            expect(Cyan500).toBe(color);
            expect(Cyan500.color).toBe('#4ba6ef');
        });
    });
    describe('VeryLightGray', () => {
        it('should be an instance with the hex code of VeryLightGray', () => {
            const color: Color = VeryLightGray;
            expect(VeryLightGray).toBe(color);
            expect(VeryLightGray.color).toBe('#c2c2c2');
        });
    });
    describe('Gray500', () => {
        it('should be an instance with the hex code of Gray500', () => {
            const color: Color = Gray500;
            expect(Gray500).toBe(color);
            expect(Gray500.color).toBe('#575757');
        });
    });
    describe('LightGray', () => {
        it('should be an instance with the hex code of LightGray', () => {
            const color: Color = LightGray;
            expect(LightGray).toBe(color);
            expect(LightGray.color).toBe('#908B8B');
        });
    });
    describe('Moroon500', () => {
        it('should be an instance with the hex code of Moroon500', () => {
            const color: Color = Moroon500;
            expect(Moroon500).toBe(color);
            expect(Moroon500.color).toBe('#b70400');
        });
    });
    describe('Blue500', () => {
        it('should be an instance with the hex code of Blue500', () => {
            const color: Color = Blue500;
            expect(Blue500).toBe(color);
            expect(Blue500.color).toBe('#3686be');
        });
    });
});
